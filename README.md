# Upskill

Upskill is a local-first certification resource catalog with a React/Vite frontend, Express API, SQLite database, and Microsoft Entra sign-in.

## Local setup

Requires Node.js 20.19+ or 22.12+.

1. Install dependencies with `npm install` in the repository root, then `npm --prefix client install` and `npm --prefix server install`.
2. Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`.
3. To work locally without Entra, set `VITE_DEV_AUTH_BYPASS=true` in `client/.env` and `DEV_AUTH_BYPASS=true` in `server/.env`. Leave both false when using Entra.
4. To test the admin review queue with local auth bypass, set `VITE_LOCAL_IS_ADMIN=true` and `ADMIN_OBJECT_IDS=local-developer`. This mode is rejected by the API in production.
5. Run `npm --prefix server run db:migrate`, then start both processes with `npm run dev`.

The frontend runs at `http://localhost:5173`; the API runs at `http://localhost:4000`. For Entra sign-in, configure the tenant, SPA client ID, API scope, API audience, and allowed SPA redirect origin in the two `.env` files.

## Resource sharing

Question sets and PDFs require confirmation that the contributor created the material or has permission to share it. Add source attribution where applicable. Do not upload copied exam questions or restricted content. PDF files are stored outside the public frontend directory and are delivered only through an authenticated API route.

Resource cards (including saved resources) and resource details display quality signals: the last administrator review date, source attribution with a link when supplied, and the number of helpful votes received. Resources without a review or attribution are explicitly labeled. Review dates indicate when an administrator marked a resource reviewed, not a guarantee that its content is current or accurate. Helpful votes represent community feedback, not verification.

The first version uses local SQLite and local PDF storage. For a multi-instance deployment, move the database and file storage to shared hosted services and configure company identity and admin IDs before deployment.