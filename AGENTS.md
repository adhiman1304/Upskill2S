# Upskill Agent Guidance

## Project Map

- Read [README.md](README.md) for setup, environment variables, local authentication, and resource-sharing rules.
- The running UI starts at `client/src/main.tsx` and is implemented in `client/src/Portal.tsx`. `client/src/App.tsx` is leftover Vite starter code; do not use it as the application entry point.
- The React client calls the Express API. Keep shared request/response changes aligned between `client/src/lib/api.ts` and `server/src/routes/api.ts`.
- API startup, middleware, and error handling are in `server/src/index.ts`. Authentication is in `server/src/middleware/requireAuth.ts`; ownership and admin policy is in `server/src/lib/permissions.ts`; request validation and sanitization is in `server/src/lib/validation.ts`.

## Data and Commands

- `prisma/schema.prisma` is the database source of truth. Add schema changes through a Prisma migration and regenerate the client; never edit `server/src/generated/prisma` directly.
- Prisma config is in `server/prisma.config.ts`; migrations are stored under `prisma/migrations/`.
- Use `npm run dev` to run the API and web app, `npm run build` for production builds, and `npm run lint` for linting. Prisma commands are `npm run db:generate` and `npm run db:migrate`.
- No automated test suite is currently defined. Do not claim tests passed unless a test script or test files have been added and run.

## Security and Content

- All API routes are protected by `requireAuth`. Keep token signature, issuer, audience, tenant, and user identity validation on the server; client-side visibility is not authorization.
- Use the authenticated request wrapper in `Portal.tsx` for signed-in API calls so it acquires and attaches the Entra access token.
- Local auth bypass requires both `VITE_DEV_AUTH_BYPASS=true` and `DEV_AUTH_BYPASS=true`; it must remain disabled in production. `VITE_LOCAL_IS_ADMIN` only changes local UI visibility. Server-side local admin access is controlled separately; production admin access uses verified roles or `ADMIN_OBJECT_IDS`.
- Preserve server-side owner/admin checks for edits, deletion, review, and moderation. Hidden resources must not leak through list, detail, preview, or download endpoints.
- Keep uploaded PDFs outside the public client directory. Validate file type, size, and signature, use generated storage names, and serve files only through authenticated API routes.
- Sanitize rich text and require HTTPS for resource/source links. Preserve contributor rights confirmation and attribution; do not introduce copied exam questions or restricted content.

## Change Discipline

- Follow existing TypeScript, React, Express, and Prisma patterns; keep changes focused and update both sides of API contracts when needed.
- Keep secrets and local `.env` files out of source control. Update `.env.example` when configuration changes.