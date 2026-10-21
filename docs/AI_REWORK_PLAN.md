# Upskill AI Rework: Game Plan

Branch: `ai-rework`. Date: 2026-10-21.

## 1. The pivot in one paragraph

Upskill today is a manual catalog: people create certifications, upload PDFs, write question sets, vote, and climb a leaderboard. Nothing in it makes the content correct or current. The rework inverts the loop. The product's front door is one question, "Which certification are you preparing for?", and the answer is produced by an LLM research pipeline that searches the web, reads the official exam page, the official learning path, and community commentary (Reddit, YouTube, blogs), and returns a **cited, versioned Study Brief** with an actionable checklist. If the user does not know which certification to take, an **intake flow** (text, voice, or an uploaded resume / project brief) recommends certifications, each one clickable into the same research pipeline. Humans no longer produce content; they verify it (accurate / inaccurate / outdated votes), track their own progress, and optionally add tips. The MVP is **bring your own OpenAI API key**: each user stores their own key, encrypted at rest, and research jobs run with the requesting user's key.

## 2. Product decisions (fixed for tonight)

| Decision | Choice | Why |
|---|---|---|
| LLM provider | OpenAI, via the official `openai` npm SDK, Responses API | User decision. Responses API has a built-in web search tool, so no scraping infrastructure. |
| Key model | BYO key per user, AES-256-GCM encrypted at rest with a server secret, never returned to the client (last 4 chars only) | MVP cost model; no shared company bill yet. |
| Models | Configurable via env. Defaults: `OPENAI_RESEARCH_MODEL=gpt-5`, `OPENAI_FAST_MODEL=gpt-5-mini`. Agents must verify current model names and the web search tool type against the live OpenAI docs before hardcoding anything. | Avoid stale names. |
| Research shape | Stage A: 4 parallel focused investigations with web search (official exam page; official learning path and practice assessment; community gaps and tips; third-party resources). Each returns markdown notes plus URL citations. Stage B: one structuring call with strict JSON schema output into the `StudyBriefContent` contract. | Structured output and tool use in a single call is fragile; splitting keeps each call simple and parallel. |
| Freshness | A brief is `fresh` if generated within `BRIEF_STALE_DAYS` (default 30) days, `stale` otherwise, `missing` if none. UI always shows age plus a Refresh button. | Honest about currency. |
| Background work | In-process job queue backed by a `ResearchJob` table, polled by the client. Concurrency 2. No Redis. | SQLite-friendly, zero infra. |
| Scheduled refresh | Nightly job refreshes stale briefs for certifications that have followers, **only if** `OPENAI_SERVER_API_KEY` is set (a company key). Without it the scheduler only flags staleness. | BYO keys cannot be used for unattended work. |
| Content policy | Braindump / exam-dump domains are blocked from research results and the model is instructed to exclude them. Human contributions keep the rights confirmation. | Existing policy, extended to the agent. |
| Legacy features | Resources, community board, contributions, leaderboard, admin reports stay functional but move to secondary navigation under "Community". No deletion tonight. | Keep colleague's work alive; it becomes the verification layer later. |
| Voice | Browser Web Speech API (`webkitSpeechRecognition`) for dictation into the intake text box. Graceful fallback when unsupported. | Zero cost, zero backend. |
| Computer-use browsing agents | Out of scope tonight. Documented as a later phase. | Web search covers the surface layer; deep thread browsing comes later. |

## 3. Target architecture

```
client (Vite + React 19 + react-router)
  /                      Home: "Which certification?" typeahead, "I don't know yet", my certifications with freshness chips
  /intake, /intake/:id   Intake: text + voice + file upload -> ranked recommendations -> click -> brief
  /certifications/:id    Study Brief: freshness header, skills outline, checklist with progress, known gaps, resources, sources, feedback votes, refresh with live job progress
  /settings              BYO OpenAI key (set / validate / clear), model info
  /admin/ops             Jobs, failures, token usage, stale briefs, "refresh all stale"
  /community, /saved, /contributions, /leaderboard, /admin/reports   legacy pages

server (Express 5 + Prisma 7 + SQLite)
  routes/api.ts          existing routes (unchanged) + mounts the new routers below
  routes/settings.ts     GET/PUT/DELETE /api/settings/openai-key
  routes/catalog.ts      GET /api/catalog/search, POST /api/catalog/resolve
  routes/briefs.ts       brief read, refresh, versions, progress, feedback, follow
  routes/jobs.ts         GET /api/jobs/:id, GET /api/me/jobs
  routes/intake.ts       POST /api/intake (multipart), GET /api/intake/:id, GET /api/me/intake, POST /api/intake/:id/select
  routes/admin-ops.ts    GET /api/admin/ops/summary, GET /api/admin/ops/jobs, POST /api/admin/ops/refresh-stale
  services/openai/       client factory per user, key validation, model config
  services/jobs/         queue, handlers registry, progress log, startup recovery
  services/research/     Stage A investigations, Stage B structuring, source filtering, brief persistence
  services/intake/       file text extraction, recommendation call
  services/catalog/      seed catalog of well-known exams, search, find-or-create
  services/scheduler/    nightly stale refresh
  lib/crypto.ts          encryptSecret / decryptSecret
  lib/contracts/         zod schemas + TS types shared by all routes (brief, intake, jobs, dtos)
```

## 4. Data model additions (Prisma, single migration `ai_rework_foundation`)

Changes to existing `Certification`: add `officialUrl String?`, `aliases String @default("[]")` (JSON array), `isCatalog Boolean @default(false)`, `lastResearchedAt DateTime?`, plus relations to the new tables. Catalog rows are created by a **system user** (`tenantId = "system"`, `objectId = "system"`, `displayName = "Upskill"`) that the seed script upserts.

New models:

```prisma
model UserProviderKey {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider        String   @default("openai")
  encryptedKey    String
  keyHint         String            // last 4 characters
  lastValidatedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([userId, provider])
}

model ResearchJob {
  id              String    @id @default(cuid())
  kind            String    // BRIEF | REFRESH | INTAKE
  status          String    @default("QUEUED") // QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED
  certificationId String?
  certification   Certification? @relation(fields: [certificationId], references: [id], onDelete: Cascade)
  intakeSessionId String?
  requestedById   String
  requestedBy     User      @relation(fields: [requestedById], references: [id], onDelete: Cascade)
  useServerKey    Boolean   @default(false)
  progress        String    @default("[]") // JSON [{ at: ISO, message }]
  error           String?
  resultBriefId   String?
  inputTokens     Int?
  outputTokens    Int?
  createdAt       DateTime  @default(now())
  startedAt       DateTime?
  finishedAt      DateTime?
  @@index([status, createdAt])
  @@index([certificationId, createdAt])
  @@index([requestedById, createdAt])
}

model StudyBrief {
  id              String   @id @default(cuid())
  certificationId String
  certification   Certification @relation(fields: [certificationId], references: [id], onDelete: Cascade)
  version         Int
  status          String   @default("CURRENT") // CURRENT | SUPERSEDED
  content         String   // JSON StudyBriefContent
  model           String
  sourceCount     Int      @default(0)
  inputTokens     Int?
  outputTokens    Int?
  jobId           String?
  requestedById   String
  requestedBy     User     @relation(fields: [requestedById], references: [id], onDelete: Restrict)
  generatedAt     DateTime @default(now())
  progress        ChecklistProgress[]
  feedback        BriefFeedback[]
  @@unique([certificationId, version])
  @@index([certificationId, status])
}

model ChecklistProgress {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  certificationId String
  certification   Certification @relation(fields: [certificationId], references: [id], onDelete: Cascade)
  briefId         String
  brief           StudyBrief @relation(fields: [briefId], references: [id], onDelete: Cascade)
  itemId          String   // checklist item id (stable slug produced by the structuring step)
  completedAt     DateTime @default(now())
  @@unique([userId, certificationId, itemId])
}

model BriefFeedback {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  briefId   String
  brief     StudyBrief @relation(fields: [briefId], references: [id], onDelete: Cascade)
  itemType  String   // brief | checklist | gap | resource | skill | learning_path
  itemId    String   // "brief" for whole-brief feedback
  verdict   String   // accurate | inaccurate | outdated
  comment   String   @default("")
  createdAt DateTime @default(now())
  @@unique([userId, briefId, itemType, itemId])
  @@index([briefId])
}

model UserCertification {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  certificationId String
  certification   Certification @relation(fields: [certificationId], references: [id], onDelete: Cascade)
  status          String   @default("STUDYING") // PLANNING | STUDYING | PASSED
  targetDate      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([userId, certificationId])
}

model IntakeSession {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  inputText       String   @default("")
  attachments     String   @default("[]") // JSON [{ name, mimeType, size, chars }]
  extractedText   String   @default("")
  status          String   @default("QUEUED") // QUEUED | RUNNING | SUCCEEDED | FAILED
  result          String?  // JSON IntakeResult
  model           String?
  error           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([userId, createdAt])
}
```

`User` gains the inverse relations: `providerKeys`, `researchJobs`, `studyBriefs`, `checklistProgress`, `briefFeedback`, `followedCertifications`, `intakeSessions`.

## 5. Contracts (the glue between workstreams)

Server: `server/src/lib/contracts/brief.ts`, `intake.ts`, `jobs.ts`, `settings.ts`, `catalog.ts` export zod schemas and inferred types. Client: `client/src/lib/contracts/*.ts` mirror the **types only** (no zod on the client). Any agent that needs a contract change writes it to `docs/handoff/<workstream>.md` instead of editing the other side; the integrator reconciles.

### 5.1 StudyBriefContent

```ts
export type SourceKind = 'official' | 'community' | 'video' | 'forum' | 'blog' | 'course' | 'other'
export interface BriefSource { id: string; url: string; title: string; publisher: string | null; kind: SourceKind; retrievedAt: string; snippet: string | null }
export interface SkillArea { id: string; title: string; weightPercent: number | null; subtopics: string[]; sourceIds: string[] }
export interface LearningPathItem { id: string; title: string; url: string; type: 'learning_path' | 'module' | 'docs' | 'practice_assessment' | 'instructor_led' | 'exam_sandbox' | 'other'; estimatedMinutes: number | null; notes: string | null; sourceIds: string[] }
export interface CommunityResource { id: string; title: string; url: string; kind: 'video' | 'course' | 'blog' | 'practice_questions' | 'github' | 'podcast' | 'forum' | 'other'; author: string | null; publishedAt: string | null; whyRecommended: string; sourceIds: string[] }
export interface KnownGap { id: string; title: string; detail: string; recommendation: string; confidence: 'high' | 'medium' | 'low'; sourceIds: string[] }
export interface ChecklistItem { id: string; order: number; phase: 'orient' | 'learn' | 'practice' | 'review' | 'exam_day'; title: string; detail: string; estimatedMinutes: number | null; links: { label: string; url: string }[]; sourceIds: string[] }
export interface StudyBriefContent {
  certification: { provider: string; code: string; title: string; officialUrl: string | null; examVersion: string | null; lastOfficialUpdate: string | null; retirementNotice: string | null }
  summary: string
  examFormat: { durationMinutes: number | null; questionCount: string | null; passingScore: string | null; cost: string | null; languages: string[]; deliveryOptions: string[]; notes: string | null }
  skillsMeasured: SkillArea[]
  officialLearningPath: LearningPathItem[]
  communityResources: CommunityResource[]
  knownGaps: KnownGap[]
  checklist: ChecklistItem[]
  warnings: string[]
  sources: BriefSource[]
}
```

Rules: every `sourceIds` entry must exist in `sources`; item ids are stable kebab-case slugs derived from the title (so progress survives a refresh when the title is unchanged); `checklist` is 10 to 25 items ordered by `phase` then `order`.

### 5.2 DTOs

```ts
export interface JobDto { id: string; kind: 'BRIEF' | 'REFRESH' | 'INTAKE'; status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'; certificationId: string | null; intakeSessionId: string | null; resultBriefId: string | null; progress: { at: string; message: string }[]; error: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null }
export interface StudyBriefDto { id: string; certificationId: string; version: number; status: 'CURRENT' | 'SUPERSEDED'; model: string; sourceCount: number; generatedAt: string; content: StudyBriefContent }
export type FreshnessStatus = 'fresh' | 'stale' | 'missing'
export interface BriefPageDto {
  certification: { id: string; provider: string; code: string; title: string; officialUrl: string | null; status: string }
  brief: StudyBriefDto | null
  freshness: { status: FreshnessStatus; generatedAt: string | null; staleAfterDays: number; ageDays: number | null }
  activeJob: JobDto | null
  progress: { completedItemIds: string[] }
  feedback: Record<string, { accurate: number; inaccurate: number; outdated: number; mine: 'accurate' | 'inaccurate' | 'outdated' | null }> // key `${itemType}:${itemId}`
  following: { status: 'PLANNING' | 'STUDYING' | 'PASSED'; targetDate: string | null } | null
}
export interface OpenAiKeyStatusDto { configured: boolean; keyHint: string | null; lastValidatedAt: string | null; models: { research: string; fast: string }; serverKeyAvailable: boolean }
export interface CatalogHitDto { certificationId: string | null; provider: string; code: string; title: string; officialUrl: string | null; source: 'db' | 'catalog'; briefStatus: FreshnessStatus; lastResearchedAt: string | null }
export interface IntakeRecommendation { rank: number; provider: string; code: string; title: string; officialUrl: string | null; level: 'fundamental' | 'associate' | 'professional' | 'specialty' | 'expert' | 'unknown'; whyFit: string; prerequisites: string[]; estimatedPrepWeeks: number | null; matchedSignals: string[] }
export interface IntakeResult { profileSummary: string; detectedSkills: string[]; goals: string[]; recommendations: IntakeRecommendation[]; followUpQuestions: string[] }
export interface IntakeSessionDto { id: string; status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; inputText: string; attachments: { name: string; mimeType: string; size: number; chars: number }[]; result: IntakeResult | null; error: string | null; jobId: string | null; createdAt: string }
```

### 5.3 Error convention

All new routes return `{ error: string, code?: string }`. Codes the client must handle: `OPENAI_KEY_MISSING` (HTTP 412, user has no key; client shows a link to /settings), `OPENAI_KEY_INVALID` (HTTP 400 on save), `JOB_ALREADY_RUNNING` (HTTP 409), `RATE_LIMITED` (HTTP 429, max 3 refreshes per certification per user per hour).

### 5.4 Service interfaces (server)

```ts
// services/openai/client.ts
export class MissingApiKeyError extends Error {}
export async function getOpenAIClientForUser(userId: string): Promise<OpenAI>      // throws MissingApiKeyError
export function getServerOpenAIClient(): OpenAI | null                              // from OPENAI_SERVER_API_KEY
export async function validateOpenAIKey(apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }>
export const openAiModels: { research: string; fast: string }

// services/jobs/queue.ts
export type JobKind = 'BRIEF' | 'REFRESH' | 'INTAKE'
export interface JobContext { jobId: string; requestedById: string; certificationId: string | null; intakeSessionId: string | null; useServerKey: boolean; log: (message: string) => Promise<void>; signal: AbortSignal }
export type JobHandler = (ctx: JobContext) => Promise<{ resultBriefId?: string; inputTokens?: number; outputTokens?: number }>
export function registerJobHandler(kind: JobKind, handler: JobHandler): void
export async function enqueueJob(input: { kind: JobKind; requestedById: string; certificationId?: string; intakeSessionId?: string; useServerKey?: boolean }): Promise<JobDto>
export async function getJob(jobId: string): Promise<JobDto | null>
export async function findActiveJob(where: { certificationId?: string; intakeSessionId?: string }): Promise<JobDto | null>
export async function recoverInterruptedJobs(): Promise<void>  // RUNNING -> FAILED on boot
export function startJobWorker(): void

// services/research/index.ts  (Workstream A implements; S0 leaves a stub that throws "not implemented")
export async function runBriefResearch(ctx: JobContext): Promise<{ briefId: string; inputTokens: number; outputTokens: number }>

// services/intake/index.ts    (Workstream C implements; S0 leaves a stub)
export async function runIntakeRecommendation(ctx: JobContext): Promise<{ inputTokens: number; outputTokens: number }>

// services/catalog/index.ts   (Workstream D implements; S0 leaves a stub)
export async function searchCatalog(query: string, userId: string): Promise<CatalogHitDto[]>
export async function resolveCertification(input: { provider: string; code: string; title: string; officialUrl?: string | null }, userId: string): Promise<{ id: string }>
```

Job handler wiring (done by S0 in `services/jobs/handlers.ts`): `BRIEF` and `REFRESH` call `runBriefResearch`; `INTAKE` calls `runIntakeRecommendation`.

## 6. Environment additions (`server/.env.example`)

```
KEY_ENCRYPTION_SECRET=            # 32+ random chars; required unless DEV_AUTH_BYPASS=true (dev fallback derives one and warns)
OPENAI_RESEARCH_MODEL=gpt-5
OPENAI_FAST_MODEL=gpt-5-mini
OPENAI_SERVER_API_KEY=            # optional; enables scheduled refresh and admin "refresh all stale"
RESEARCH_MAX_WEB_SEARCHES=16      # across all Stage A investigations of one brief
BRIEF_STALE_DAYS=30
BLOCKED_RESEARCH_DOMAINS=examtopics.com,braindumps.com,dumpsbase.com,pass4sure.com,exam-labs.com,itexams.com,certlibrary.com
SCHEDULER_ENABLED=false
SCHEDULER_CRON=0 3 * * *
INTAKE_MAX_FILES=3
INTAKE_MAX_FILE_BYTES=10485760
```

## 7. Workstreams and file ownership

Rule: an agent edits only the files it owns. Anything else goes into `docs/handoff/<id>.md` for the integrator. Nobody commits, nobody switches branches, nobody runs `prisma migrate` except S0.

### Wave 0 (two agents in parallel)

**S0: Server foundations.** Owns: `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed/**` (empty catalog.json placeholder with 5 entries), `server/package.json`, `server/.env.example`, `server/src/config.ts`, `server/src/index.ts`, `server/src/routes/api.ts` (mounting only), `server/src/lib/crypto.ts`, `server/src/lib/contracts/**`, `server/src/services/openai/**`, `server/src/services/jobs/**`, stub files `server/src/services/research/index.ts`, `server/src/services/intake/index.ts`, `server/src/services/catalog/index.ts`, stub routers `server/src/routes/{settings,catalog,briefs,jobs,intake,admin-ops}.ts` (each exports a `Router` with one `501` placeholder route). Done when: `npm --prefix server run db:migrate` applies, `npm --prefix server run build` passes, `npm --prefix server run lint` passes, `GET /api/health` and `GET /api/settings/openai-key` (the real one, S0 implements settings fully since it owns crypto) work.

**C0: Client foundations.** Owns: `client/src/main.tsx`, `client/src/Portal.tsx` (becomes the router shell), `client/src/App.tsx` (delete), `client/src/session.tsx` (SessionContext, `useSession`, `useApi` extracted), `client/src/lib/api/client.ts` (`apiRequest`, `ApiError`, `AuthenticatedRequest` type), `client/src/lib/api/legacy.ts` (existing functions moved from `lib/api.ts`; keep `lib/api.ts` re-exporting for compatibility), `client/src/lib/contracts/**`, `client/src/components/layout/**` (AppShell, Sidebar with new nav, ApiKeyBanner), `client/src/pages/legacy/**` (Dashboard, DetailView, SavedResources, CommunityBoard, ContributionHistory, ContributorDashboard, AdminReviewPanel and dialogs moved out of Portal.tsx with their behavior intact), placeholder pages `client/src/pages/{home/HomePage.tsx,intake/IntakePage.tsx,intake/IntakeResultPage.tsx,brief/BriefPage.tsx,settings/SettingsPage.tsx,admin/AdminOpsPage.tsx}` each rendering a titled placeholder, `client/src/index.css` / `Portal.css` (only if the shell needs it). Done when: `npm --prefix client run build` and lint pass, every route renders, legacy pages still work against the existing API.

### Wave 1 (five agents in parallel, after Wave 0 is committed)

**A: Research pipeline.** Owns: `server/src/services/research/**`, `server/src/scripts/research-cli.ts`, `server/package.json` script `research` only (append a line). Implements Stage A and Stage B, source filtering by `BLOCKED_RESEARCH_DOMAINS`, source id validation, slug ids, token accounting, writes `StudyBrief` (supersedes the previous CURRENT), updates `Certification.lastResearchedAt` and `officialUrl`, logs progress through `ctx.log` after each investigation. CLI: `npm --prefix server run research -- --code DP-700 --provider Microsoft --key sk-...` prints the brief JSON and writes it to the database. Verifies the Responses API web search tool type and structured output syntax against the live OpenAI docs first and records what it found in `docs/handoff/A.md`.

**B: Study Brief experience.** Owns: `server/src/routes/briefs.ts`, `server/src/routes/jobs.ts`, `server/src/lib/rate-limit.ts`, `client/src/pages/brief/**`, `client/src/lib/api/briefs.ts`, `client/src/lib/api/jobs.ts`. Implements every brief and job route in section 5, the brief page (freshness header, refresh with live progress polling every 2 seconds, skills outline with weights, checklist grouped by phase with check-off, known gaps, learning path, community resources, sources panel, per-item feedback votes, follow / target date), version history drawer, and the `OPENAI_KEY_MISSING` state. Uses a realistic fixture brief in `client/src/pages/brief/fixtures/dp-700.sample.ts` for development while A is in flight.

**C: Intake and recommendations.** Owns: `server/src/services/intake/**`, `server/src/routes/intake.ts`, `client/src/pages/intake/**`, `client/src/lib/api/intake.ts`, `client/src/hooks/useSpeechDictation.ts`. Implements multipart upload (PDF via `pdf-parse`, DOCX via `mammoth`, TXT/MD as-is), text extraction and trimming to a token-safe size, the recommendation call with strict JSON schema output (`IntakeResult`), job polling, the results page with recommendation cards, and "Start studying" which calls `POST /api/intake/:id/select` then navigates to `/certifications/:id`. Dictation button uses the Web Speech API with a clear unsupported state.

**D: Home, catalog and settings UI.** Owns: `server/src/routes/catalog.ts`, `server/src/services/catalog/**`, `prisma/seed/catalog.json` (grow to 60+ well-known exams across Microsoft, AWS, Google Cloud, CompTIA, Cisco, ISC2, ISACA, PMI, PeopleCert, Linux Foundation, HashiCorp, Red Hat, Oracle, Salesforce, Databricks, Snowflake), `prisma/seed/seed.ts` + `server/package.json` script `db:seed` (append a line), `client/src/pages/home/**`, `client/src/pages/settings/**`, `client/src/lib/api/catalog.ts`, `client/src/lib/api/settings.ts`. Home: hero question with debounced typeahead over db + catalog, result rows show freshness chip, "I don't know yet, help me choose" leading to `/intake`, "My certifications" section from `UserCertification`, provider tiles reused from the legacy dashboard. Settings: key entry with show/hide, validate-on-save, key hint, clear, model info, server key availability notice. `resolveCertification` is find-or-create by normalized provider+code.

**E: Scheduler, admin ops and observability.** Owns: `server/src/services/scheduler/**`, `server/src/services/ops/**`, `server/src/routes/admin-ops.ts`, `client/src/pages/admin/**`, `client/src/lib/api/adminOps.ts`. Scheduler: `node-cron` (add to `server/package.json` dependency only), runs when `SCHEDULER_ENABLED=true` and a server key exists, enqueues `REFRESH` with `useServerKey: true` for stale briefs of certifications with at least one follower, max 10 per run. Admin ops page: summary tiles (briefs total, stale, jobs last 24h by status, tokens last 7 days), job table with filters and progress log viewer, "Refresh all stale" button (admin only, requires server key, otherwise disabled with reason). Admin check reuses `isAdmin`.

### Wave 2 (one agent, then the orchestrator)

**I: Integration and verification.** Owns everything. Reads every `docs/handoff/*.md`, reconciles contracts, runs `npm run lint` and `npm run build`, runs the dev servers, smoke-tests each route in a browser (local auth bypass), fixes cross-workstream mismatches, updates `README.md`, `AGENTS.md`, `.env.example` files, and writes `docs/handoff/INTEGRATION.md` listing what was verified and what was not. Does not add features.

### Wave 3 (one agent, after integration)

**G: Design pass.** Owns every file under `client/src/` (no server changes, no behavior changes, no new features). Goal: the product should feel simple, familiar and to the point. Principles:

- One type family for everything (keep DM Sans for body and UI; drop Space Grotesk unless it is used only for the brand mark). One scale of sizes (base 15 or 16 px, four steps), one weight for headings and one for body.
- Density: nothing takes more space than it needs. Tighter paddings, fewer cards inside cards, fewer boxes with borders; use whitespace and alignment instead of chrome. Remove decorative gradients, badges and icons that carry no information.
- One consistent layout grammar: a page has a title row, an optional one-line description, then content in a single column (max width about 960 px) except where a side panel earns its place (brief sources). Same header pattern on every page.
- Primary action is obvious on every page and there is at most one primary button per view. Secondary actions are quiet text buttons.
- Familiar components: plain inputs, standard checkboxes, native-feeling selects, simple tables, standard link styling. No novel interaction patterns.
- Color: a neutral palette, one accent, semantic colors for fresh / stale / error only. Dark mode is not required.
- Mobile transfers for free when the above is followed: single column, sidebar collapses to a top bar with a menu, tap targets at least 40 px, no horizontal scroll. Verify at 390 px and 1280 px widths.
- Clean up: consolidate the scattered CSS files (`Portal.css`, `Features.css`, `Community.css`, `ProviderDirectory.css`, `layout.css`, per-page css) into `client/src/styles/` with tokens in one place; delete dead classes; legacy pages get the same treatment but not a redesign.

Done when: every route renders with the new system at both widths, lint and build pass, and `docs/handoff/G.md` lists the token set and the before/after decisions.

Orchestrator (Claude in this session): commits after each wave, writes `docs/STANDUP_NOTES.md`.

## 8. Agent working rules

1. Read this document fully before touching code. Read `AGENTS.md` and `README.md`.
2. Edit only owned files. Needed changes elsewhere go in `docs/handoff/<id>.md` with exact proposed diffs.
3. Follow existing style: TypeScript strict, ESM imports with `.js` suffix on the server, zod for validation, `requireAuth` on every API route, `currentUser` for identity, `isAdmin` for admin routes, sanitized output, HTTPS-only external links.
4. Never return a decrypted API key to a client. Never log one.
5. Verify your own work: `npm --prefix server run build && npm --prefix server run lint` and / or `npm --prefix client run build && npm --prefix client run lint`. Other workstreams' in-progress files may break a full build; if a failure is clearly outside your files, note it in your handoff and move on.
6. No commits, no branch changes, no `git stash`, no `prisma migrate` (S0 excepted), no deleting other people's files.
7. Finish with a short report: what works, what is stubbed, what the integrator must know.

## 9. Later phases (not tonight)

- Deep browsing agent (computer use) for nested Reddit / YouTube comment threads, transcripts via the YouTube Data API.
- Company-paid key with per-user quotas instead of BYO.
- Personalized study plan: brief checklist adjusted by the intake profile and target date, with calendar export.
- Practice question generation from the brief with rights-safe sourcing.
- Convert legacy resources into "community tips" attached to brief items.
- Postgres and object storage for multi-instance deployment.
