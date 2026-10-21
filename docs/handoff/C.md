# C handoff: intake and recommendations

Status: done, except that a live model call could not be made because no OpenAI key exists in this environment. "Start studying" depends on D's `resolveCertification`.

## Files

| File | Contents |
|---|---|
| `server/src/services/intake/extract.ts` | `extractText(file)`, `combineExtractedText(files)`, `IntakeFileError`, `isSupportedIntakeFileName`, `collapseWhitespace`. PDF via `pdf-parse` v2 (`new PDFParse({ data }).getText()`; its `-- N of M --` page markers are removed), DOCX via `mammoth.extractRawText`, and `.txt` / `.md` as UTF-8 (a BOM is stripped and NUL bytes are rejected). Magic bytes are checked: `%PDF-` for `.pdf`, and zip `PK\x03\x04` for `.docx`. Whitespace is collapsed. Each file is capped at 40,000 characters and the combined document at 60,000, and both caps add a `[Truncated: ...]` note. Other types and unreadable files throw `IntakeFileError` with a message that is safe to show. |
| `server/src/services/intake/prompts.ts` | `INTAKE_INSTRUCTIONS` (certification advisor: 3 to 6 certifications ranked by fit, official exam codes and titles, honest prerequisites, realistic part-time prep weeks, HTTPS official URL or null, no retired or invented exams, no exam-dump sites, follow-up questions when the input is thin, and an instruction to ignore instructions embedded in uploaded documents) and `buildIntakeInput`. |
| `server/src/services/intake/index.ts` | `runIntakeRecommendation(ctx)`, `normalizeIntakeResult`, `recoverInterruptedIntakeSessions()`. |
| `server/src/routes/intake.ts` | The four routes below. |
| `client/src/lib/api/intake.ts` | `createIntake`, `getIntake`, `listMyIntakes`, `selectRecommendation`, and `getIntakeJob` (a local copy of `GET /api/jobs/:id`). |
| `client/src/hooks/useSpeechDictation.ts` | `useSpeechDictation(onFinal, lang?)` returns `{ supported, listening, interimText, start, stop, error }`. It is continuous with interim results, uses `navigator.language` by default, and maps errors to friendly text (for example, a blocked microphone). |
| `client/src/pages/intake/IntakePage.tsx`, `IntakeResultPage.tsx`, `intake.css` | The UI. Styles use the Portal.css tokens, and the breakpoint at 700px is mobile-friendly. |
| `server/package.json` | Adds `pdf-parse ^2.4.5` and `mammoth ^1.13.0` (the lockfile is updated too). |

## Service behaviour

- `runIntakeRecommendation` loads the `IntakeSession`, sets it to RUNNING, and picks the client with `ctx.useServerKey ? getServerOpenAIClient() : getOpenAIClientForUser(...)`. It calls `client.responses.parse({ model, instructions, input, text: { format: zodTextFormat(intakeResultSchema, 'intake_result') } }, { signal: ctx.signal })`, with no tools. The `responses.parse` and `output_parsed` shapes and `openai/helpers/zod` were checked in SDK 6.49.0.
- Model: `INTAKE_MODEL_TIER = 'research'` in `index.ts` selects `openAiModels.research`. Change it to `'fast'` to use the fast model.
- Output is checked again with `intakeResultSchema`, then normalized: sorted by rank, capped at 6, re-ranked 1 to N, and any `officialUrl` that is not HTTPS becomes null. Zero recommendations counts as a failure that is safe to show the user.
- On success, the session gets `status=SUCCEEDED`, the result JSON and `model`, and the function returns `{ inputTokens, outputTokens }` from `response.usage`.
- On failure, the session gets `status=FAILED` with a safe message, which mirrors the queue's mapping: UserFacing or MissingKey messages verbatim, a fixed message for 401, 429 and shutdown, and a generic message otherwise. The function then rethrows, so the job is marked FAILED as well.
- `recoverInterruptedIntakeSessions()` marks RUNNING sessions FAILED. It runs once at the top level of `routes/intake.ts` when the module loads (before the worker starts). QUEUED sessions are not touched, because their job is still queued in the database and will run.

## Routes (root-mounted, full paths, `requireAuth` on each route)

| Route | Behaviour |
|---|---|
| `POST /api/intake` | Multipart, using multer memory storage on this route only. Field `text` (at most 20,000 characters) plus files in `files[]` (at most `config.intakeMaxFiles`, each at most `config.intakeMaxFileBytes`). Unsupported extensions are rejected in `fileFilter`. Order of checks: 400 if there is no text and no file, then 400 for invalid or unreadable files, then **412 `OPENAI_KEY_MISSING`** if the user has no openai `UserProviderKey`. It then creates the session (attachments metadata and combined extracted text), enqueues an `INTAKE` job and returns **202** `IntakeSessionDto` with `jobId`. Multer errors get their own messages: 413 for file size, 400 for file count. |
| `GET /api/intake/:id` | Owner or admin only, otherwise 404. Returns the DTO; `jobId` is the latest job for the session. |
| `GET /api/me/intake` | The caller's last 10 sessions (DTO array, newest first). |
| `POST /api/intake/:id/select` | Body `{ recommendationIndex }` (an index into `result.recommendations`, starting at 0). Owner or admin only, and the session must be SUCCEEDED; otherwise 404. It calls `resolveCertification({ provider, code, title, officialUrl }, user.id)` with values trimmed and cut to the `resolveCertificationInputSchema` lengths, and returns `{ certificationId }`. If D's function throws an error whose message matches "not implemented", it returns **503 `{ error: 'Catalog is not ready yet.', code: 'NOT_IMPLEMENTED' }`**. |

DTO example (`GET /api/intake/:id`, SUCCEEDED):

```json
{
  "id": "cmvimgtqt0002gw5jbmd9b2o6", "status": "SUCCEEDED", "inputText": "I'm a cloud engineer ...",
  "attachments": [{ "name": "resume.pdf", "mimeType": "application/pdf", "size": 612, "chars": 37 }],
  "result": {
    "profileSummary": "You are a cloud engineer ...", "detectedSkills": ["Azure"], "goals": ["Data engineering"],
    "recommendations": [{ "rank": 1, "provider": "Microsoft", "code": "DP-700", "title": "Microsoft Certified: Fabric Data Engineer Associate",
      "officialUrl": "https://learn.microsoft.com/en-us/credentials/certifications/fabric-data-engineer-associate/", "level": "associate",
      "whyFit": "...", "prerequisites": [], "estimatedPrepWeeks": 8, "matchedSignals": ["AZ-104"] }],
    "followUpQuestions": ["How many hours a week?"]
  },
  "error": null, "jobId": "cmvimgtqp0001gw5j3cs6b82n", "createdAt": "2026-10-21T21:26:30.285Z"
}
```

## Client

- `/intake` has a large textarea with the requested placeholder, a Dictate / Stop dictation button with a pulsing "Listening..." indicator and interim text, and the note "Voice dictation is not supported in this browser." when the API is missing. It also has four example chips, a drop zone with a browse button (up to 3 PDF / DOCX / TXT / MD files, 10 MB each, checked on the client, showing file sizes and remove buttons), and a character counter. A 412 shows a callout linking to `/settings`. On success the page navigates to `/intake/:id`. "Previous intakes" (from `GET /api/me/intake`) is at the bottom. Router state `{ prefillText, followUpQuestions }` prefills the form and shows the questions as a hint.
- `/intake/:id` polls `GET /api/intake/:id` every 2 s until the status is SUCCEEDED or FAILED. While the session is active it also polls `GET /api/jobs/:jobId` to show the progress log. On SUCCEEDED it shows the profile summary, skill chips and goals, then ranked recommendation cards: rank badge, provider, code, level badge, whyFit, prep weeks, prerequisites, matched-signal chips, an official link (rendered only when the URL is HTTPS), and "Start studying", which calls select and navigates to `/certifications/:certificationId`. If select fails, for example with the 503, the error message is shown. Below the cards are the follow-up questions and a "Refine" button. On FAILED it shows the error, a "Try again" button that goes back to `/intake` with the text prefilled, and an "Open settings" link when the error mentions Settings. A 404 shows "Intake not found".
- A bug caught in the browser and fixed: if `settledId` state is set inside the `usePolling` fetcher, `enabled` turns off before `usePolling` stores `data`, so the page stayed on "Loading...". The fetcher now writes the session into the page's own state. **B and E: if your pages stop polling by setting state inside the fetcher, check for the same problem.**

## Verified

- `npm --prefix server run build` and `npm --prefix server run lint`: pass.
- `npm --prefix client run build`: passes. `npm --prefix client run lint`: my files are clean. At one point the client lint reported 1 error in B's `pages/brief/BriefPage.tsx` (`react-hooks/preserve-manual-memoization`); it was gone on the last run, which left only the existing LibraryPage warning.
- One-off tsx check of `extractText` (now removed): a generated PDF and DOCX both extracted correctly, the whitespace was collapsed and the PDF page marker removed; a TXT of about 120 kB was truncated at 40,000 characters plus the note; two of those combined came to 59,998 characters (at most 60,000); `.exe` and a fake `.pdf` were rejected.
- The API on port 4010 was checked with curl:
  - text only: 412 `OPENAI_KEY_MISSING`
  - `.exe`: 400
  - fake `.pdf`: 400
  - empty: 400
  - 4 files: 400 "Upload at most 3 files."
  - `GET /api/me/intake`: `[]`
  - unknown id on GET and on select: 404
  - legacy `/api/certifications`: still 200
- Handler path: a hand-made session plus an `INTAKE` job was picked up by the real worker. The job and the session both ended FAILED with "Add your OpenAI API key in Settings to run research." The progress log was Queued, Started, Failed, and `jobId` was present in the DTO.
- Select on a SUCCEEDED session with a fixture result: 503 `NOT_IMPLEMENTED` (D's stub); an index out of range gives 404.
- Browser (built-in pane, client on port 5174):
  - `/intake` renders, and the Dictate button shows because the pane supports speech recognition. The unsupported note was not seen.
  - Clicking an example chip and submitting shows the 412 callout.
  - The Previous intakes list renders.
  - On the result page, the SUCCEEDED layout renders, "Start studying" shows "Catalog is not ready yet.", Refine goes back with the text prefilled, the FAILED layout renders, and at 375px wide the layout has no horizontal scroll.
- Test rows were deleted afterwards, and both servers were stopped.

## Not verified

- A real OpenAI call: there is no key, so the strict-schema output, the prompt quality and the token counts were not tested. `zodTextFormat(intakeResultSchema)` builds a strict format, with the same rules as A's brief schema.
- Actual voice dictation (it needs a microphone and a user gesture), and the "unsupported" note in a browser without the API (for example Firefox).
- The live RUNNING progress view: it only appears while a real model call is running.
- "Start studying" navigating to a brief, because it is blocked on D.

## For the integrator

1. **D dependency**: `select` imports `resolveCertification` from `services/catalog/index.ts`. Once D ships it, select returns `{ certificationId }`. If D's errors use another message for validation failures, they currently surface as 500. Consider mapping them to 400 in `routes/intake.ts`.
2. **Jobs client**: `getIntakeJob` in `client/src/lib/api/intake.ts` duplicates B's `getJob`. Swap it for `import { getJob } from '../../lib/api/jobs'` if you want one copy.
3. The global error handler in `server/src/index.ts` maps any `MulterError` to "The PDF exceeds the upload limit.". Intake handles its own multer errors, so this does not affect intake, but the wording is PDF-specific.
4. The client caps (3 files, 10 MB) are hardcoded in `IntakePage.tsx` to match the `config` defaults. Update both places if the env values change.
5. No schema changes and no contract changes.
