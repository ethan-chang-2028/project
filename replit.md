# StepCheck

A homework platform where teachers assign step-based problems and students submit their work for grading. This repo currently implements the account/authentication backend; the grading workspace is described in the product spec under `attached_assets/`.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; `PORT` — port the API server listens on (e.g. `5000`). Optional: `NODE_ENV` (`production` enables the `Secure` flag on session cookies), `LOG_LEVEL`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/` — `users.ts`, `sessions.ts`. Run `pnpm --filter @workspace/db run push` to apply.
- API contract (source of truth): `lib/api-spec/openapi.yaml`. After editing it, run `pnpm --filter @workspace/api-spec run codegen` to regenerate the Zod schemas (`lib/api-zod`) and React Query client (`lib/api-client-react`). Never hand-edit the `generated/` folders.
- Auth backend: `artifacts/api-server/src/lib/auth.ts` (hashing + sessions), `src/middlewares/auth.ts` (`attachUser`, `requireAuth`), `src/routes/auth.ts` (endpoints).

## Architecture decisions

- **Passwords** are hashed with Node's built-in `scrypt` (no native dependency). `bcrypt`/`argon2` are intentionally externalized by the esbuild bundle, so a pure-JS KDF keeps the single-file build portable.
- **Sessions** are opaque server-side rows, not JWTs. The cookie carries a random token; the DB stores only its SHA-256 hash, so a leaked row can't be replayed as a live cookie. Cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **Auth is cookie-based** (browser sends it automatically). CORS uses `origin: true` + `credentials: true` so a separate frontend origin can authenticate. Do not use the bearer-token getter in `custom-fetch.ts` for the web app.
- Request bodies are validated with the generated Zod schemas (`SignupBody`, `LoginBody`) — the OpenAPI spec is the single source of validation truth shared by server and client.

## Product

- Users can sign up (as a `student` or `teacher`), log in, log out, and fetch the current user. Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
