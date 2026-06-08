# StepCheck

A homework platform where teachers assign step-based problems and students submit their work for grading. This repo currently implements the account/authentication backend; the grading workspace is described in the product spec under `attached_assets/`.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run seed` — create/refresh demo accounts (idempotent). Teacher `teacher@stepcheck.test` / `Teacher123!`, student `student@stepcheck.test` / `Student123!` (demo credentials only). Requires `DATABASE_URL` and that the schema has been pushed.
- Required env: `DATABASE_URL` — Postgres connection string; `PORT` — port the API server listens on (e.g. `5000`). Optional: `NODE_ENV` (`production` enables the `Secure` flag on session cookies), `LOG_LEVEL`.
- Google sign-in (optional): set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (from the Google Cloud console). Register the callback as an Authorized redirect URI; either set `OAUTH_REDIRECT_URI` to that exact URL or let the server derive it from the request. Optional: `APP_POST_LOGIN_REDIRECT` (default `/dashboard`), `APP_LOGIN_REDIRECT` (default `/login`). The web app shows the Google button by default; build with `VITE_GOOGLE_ENABLED=false` to hide it. When the vars are unset, the button degrades to `/login?error=google_not_configured`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/` — `users.ts`, `sessions.ts`, `classes.ts`, `assignments.ts`, `problems.ts`. Run `pnpm --filter @workspace/db run push` to apply.
- API contract (source of truth): `lib/api-spec/openapi.yaml`. After editing it, run `pnpm --filter @workspace/api-spec run codegen` to regenerate the Zod schemas (`lib/api-zod`) and React Query client (`lib/api-client-react`). Never hand-edit the `generated/` folders.
- Auth backend: `artifacts/api-server/src/lib/auth.ts` (hashing + sessions), `src/middlewares/auth.ts` (`attachUser`, `requireAuth`, `requireRole`), `src/routes/auth.ts`.
- Teacher backend: `artifacts/api-server/src/routes/classes.ts` (classes, assignments, problems — teacher-gated with per-row ownership checks).
- Teacher UI: `artifacts/web/src/pages/teacher/` (`Classes`, `ClassDetail`, `AssignmentDetail`), gated by `components/teacher/RequireTeacher.tsx`.

## Architecture decisions

- **Passwords** are hashed with Node's built-in `scrypt` (no native dependency). `bcrypt`/`argon2` are intentionally externalized by the esbuild bundle, so a pure-JS KDF keeps the single-file build portable.
- **Sessions** are opaque server-side rows, not JWTs. The cookie carries a random token; the DB stores only its SHA-256 hash, so a leaked row can't be replayed as a live cookie. Cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **Auth is cookie-based** (browser sends it automatically). CORS uses `origin: true` + `credentials: true` so a separate frontend origin can authenticate. Do not use the bearer-token getter in `custom-fetch.ts` for the web app.
- Request bodies are validated with the generated Zod schemas (`SignupBody`, `LoginBody`) — the OpenAPI spec is the single source of validation truth shared by server and client.
- **Google sign-in** is a server-side OAuth 2.0 code flow (`GET /api/auth/google` → Google → `GET /api/auth/google/callback`) implemented with Node's global `fetch` (no SDK). It's intentionally *not* in the OpenAPI spec because it's browser navigation, not a typed client call. CSRF is covered by a short-lived `oauth_state` cookie; on success the same opaque session cookie is issued. `users.password_hash` is nullable so Google-only accounts have no password; a Google login is linked to an existing email-based account when the emails match.

## Product

- Users can sign up (as a `student` or `teacher`), log in (password or **Google**), log out, and fetch the current user. Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/google`, `GET /api/auth/google/callback`.
- **Teachers** can create classes (each gets a student join code), add assignments to a class, and author step-based problems (a stem plus an ordered answer key of `{prompt, answer}` steps). Endpoints (all teacher-only): `GET/POST /api/classes`, `GET /api/classes/{id}`, `GET/POST /api/classes/{id}/assignments`, `GET /api/assignments/{id}`, `POST /api/assignments/{id}/problems`. Problem steps are stored as JSONB on `problems`. The student-facing join/submit flow is not built yet.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
