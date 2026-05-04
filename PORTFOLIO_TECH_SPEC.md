# Recount — technical specification (portfolio handoff)

Paste this file into another workspace (or attach it to a chat) so an assistant can reason about the codebase without opening the repo first.

---

## Product (one sentence)

**Recount** is a productivity product: a **Chrome MV3 extension** passively tracks time by **domain** (batched to a backend), a **Next.js** web app is the **marketing site + authenticated dashboard** (intentions, history, reports, settings, admin for staff), and a **REST API** owns **mutations** and **privileged reads** against **Supabase (Postgres + Auth)** with **Stripe** licensing, optional **OpenAI** report generation, and **Resend** for email (e.g. weekly digest).

**Version context:** Monorepo packages are tagged **0.2.1** in `package.json` files; extension `manifest.json` still shows **0.1.0** (known drift).

---

## Repository shape

- **Tooling:** npm **workspaces** (`"workspaces": ["packages/*"]`), **Node ≥ 20** (root `engines`; CI uses Node 22).
- **Packages:**
  - **`packages/shared`** — ESM library: `DOMAIN_CATEGORIES` / `classifyDomain`, `APP_ROLES` / `isAppRole`. Subpath export `./domain-categories`.
  - **`packages/api`** — **Primary backend:** Express 4, **JavaScript (ESM)**, Zod env validation, Pino logging, Vitest + Supertest. Uses **Supabase service role** (bypasses RLS).
  - **`packages/api-worker`** — **Cloudflare Worker** port: **Hono** + **TypeScript**, Zod-validated Worker bindings, mirrors most `/api/*` routes; intended as deploy target alongside/alternate to Express (see `pending` stub loop in `index.ts` for not-yet-migrated routes — currently empty array).
  - **`packages/web`** — **Next.js 14.2** (App Router), **TypeScript**, **Tailwind**, **Supabase SSR** (`@supabase/ssr`), **Zustand**, **Recharts**, **Framer Motion**, **Geist** font. Deploy path: **OpenNext + Cloudflare** (`@opennextjs/cloudflare`, Wrangler).
  - **`packages/extension`** — **Chrome Manifest V3**, vanilla JS, **esbuild** build → `dist/`, **Tailwind** for UI surfaces. Background service worker module; popup + options pages; content scripts for nudges (`web_accessible_resources`).

- **Root scripts:** `dev:api` (:3001), `dev:web` (:3000), `dev:api:worker` (Wrangler dev), `build`, `build:extension`, `test` (workspaces), `deploy` / `deploy:cf`, `deploy:web`, `deploy:api`, `sync:cf:env`, `loc`.

- **Docs:** `docs/integrations-setup.md`, `docs/cloudflare-native-deploy.md`; security notes in `SECURITY.md`, `SECURITY_HARDENING.md`, `docs/SECURITY_FINDINGS.md`.

- **Cursor context:** `.cursor/database-schema.md` is the **human-readable schema summary**; `.cursor/rules/supabase-security.mdc` defines RLS/grant conventions for new tables.

---

## Authentication and authorization

- **Clients** (extension + browser) send **`Authorization: Bearer <Supabase JWT>`** to the API.
- **API** validates JWT via **`supabaseAdmin.auth.getUser(token)`**, then loads/creates **`profiles`** row (FK to `auth.users.id`).
- **Roles:** `profiles.app_role` ∈ `user` | `admin` | `developer` (canonical in DB + `@recount/shared`). **`admin`/`developer`** = elevated staff (`requireElevatedStaff`-style middleware in API; Worker has parallel `roles` middleware).
- **Billing vs staff:** **`license_active`** (Stripe) unlocks Pro features; **staff roles** also get full product access in UI logic — see `packages/web/src/lib/entitlements.ts` (`hasFullProductAccess`).
- **Next.js:** Session refresh via **`packages/web/src/middleware.ts` → `@/lib/supabase/middleware`** (`updateSession`); matcher excludes `_next` and common static assets.

---

## Data layer (Supabase / Postgres)

- **Migrations (source of truth):** `packages/api/src/db/migrations/` — apply **001 → 012** in order in Supabase SQL editor.
- **Core tables:** `profiles`, `intentions`, `tab_events`, `reports`, `payments`, `login_events`, plus **`stripe_webhook_events`** (011, idempotent Stripe processing), and profile fields for distraction/blocked domains, demographics, team/leaderboard, digest prefs, etc. (see `.cursor/database-schema.md` for full column lists).
- **Security model:** API uses **service role** and **bypasses RLS** for writes and sensitive reads. Browser/Next use **anon + user JWT** with **RLS**: after **010**, pattern is **S1b** — users **SELECT** own rows; **`admin`/`developer`** can **SELECT** all on key tables via **`current_user_is_elevated_staff()`** (SECURITY DEFINER helper). **No** general `INSERT`/`UPDATE`/`DELETE` for `authenticated` on those tables — mutations go through API.
- **Triggers:** e.g. new auth user → profile row (`handle_new_user`); `tab_events` derive `date` and `duration_sec` from timestamps.
- **RPCs (service_role only):** e.g. `admin_audience_dashboard`, `admin_analytics_timeseries` for admin analytics.

---

## Express API (`packages/api`)

- **Entry:** `src/server.js` serves `src/app.js`.
- **Stack:** express, helmet (CSP off for API), cors (allowlist from `ALLOWED_ORIGINS` + dev localhost variants), compression, **express-rate-limit** on `/api`, **express.json** (64kb) except Stripe webhook (**raw** body on `POST /api/payments/webhook`).
- **Routes mounted under `/api`:** `auth`, `events`, `intentions`, `reports`, `payments`, `profiles`, `admin`, `team`, `jobs`. **`GET /health`** at root.
- **Env (Zod):** `packages/api/src/config/env.js` — Supabase URL + service + anon keys, OpenAI, Stripe (secret + webhook secret), Resend, `FROM_EMAIL`, `PORT`, `ALLOWED_ORIGINS`, `WEB_URL`, optional `JWT_SECRET` (unused for auth), `DIGEST_JOB_SECRET`, `LOGIN_AUDIT_SALT`, `TRUST_PROXY` / `TRUST_PROXY_HOPS`. **Non-production** can use **dev placeholders** for missing vars unless `RELAXED_ENV=0`.

---

## Cloudflare Worker API (`packages/api-worker`)

- **Framework:** Hono on **`fetch`** export (Wrangler).
- **CORS:** Custom middleware (no `@hono/cors`): origin canonicalization, preflight 403 if not allowlisted; allow headers include `Authorization`, `X-Recount-Job-Secret`, `Stripe-Signature`.
- **Env:** `packages/api-worker/src/env.ts` — same conceptual secrets as Express (no `PORT`); validated with Zod after CORS (except `/health`).
- **Parity:** Routes align with Express (`auth`, `events`, `intentions`, `payments`, `profiles`, `reports`, `team`, `jobs`, `admin`). Shared business logic often in `src/lib/*`, `src/services/*` (OpenAI, Stripe, Resend).

---

## Web app (`packages/web`)

- **Routing:** App Router under `src/app/` — marketing pages, `login` & `signup`, `dashboard/*` (activity, history, reports, settings, admin, pricing, privacy).
- **API calls:** Server components / route handlers use **`getApiBaseUrl()`** (`src/lib/api-url.ts`) — normalizes localhost vs `127.0.0.1` for SSR vs browser CORS confusion. **`NEXT_PUBLIC_API_URL`** points at Express or Worker.
- **State / UI:** Zustand where needed; Recharts for admin analytics; shared UI under `src/components/ui/`.

---

## Browser extension (`packages/extension`)

- **Permissions:** `tabs`, `webNavigation`, `storage`, `alarms`, `activeTab`, `scripting`, `idle`, `notifications`; **optional** broad host permissions — user grants for tracking.
- **Integration:** Resolves API base and web origin from **`constants.js`** / options (`resolve-api-base.js`, `resolve-web-base.js`). **CORS:** deployed API must include **`chrome-extension://<id>`** in `ALLOWED_ORIGINS`.
- **Features:** Background aggregates tab time by domain, batches to API; intent-lock / EOD nudges via injected scripts referenced in manifest.

---

## External services

| Service    | Use                                                                 |
| ---------- | ------------------------------------------------------------------- |
| Supabase   | Auth, Postgres, service role in API/Worker                          |
| Stripe     | Checkout session, webhook → `license_active` / customer id; dedupe via `stripe_webhook_events` |
| OpenAI     | Daily AI report text (licensed users)                               |
| Resend     | Transactional / digest email                                        |

---

## Testing and CI

- **API:** **Vitest** + **Supertest**; tests under `packages/api/src/routes/__tests__/` (e.g. payments webhook, authorization).
- **GitHub Actions:** `.github/workflows/ci-security.yml` — API tests, **Next lint + production build**, dependency audit (and more in full file). Triggers on PR and push to `main`.

---

## Deployment notes

- **Express:** Traditional Node host; env as in `env.js`.
- **Cloudflare:** `packages/web/wrangler.toml`, `packages/api-worker/wrangler.toml`; scripts `deploy-cf.mjs`, `deploy-web-cf.mjs`, `deploy-api-cf.mjs`, `sync-cf-env.mjs`. See `docs/cloudflare-native-deploy.md`.

---

## Files worth opening first in a new workspace

1. Root `README.md` (architecture diagram, API table, quick start).
2. `.cursor/database-schema.md` (schema + RLS).
3. `packages/api/src/app.js` (route map).
4. `packages/api-worker/src/index.ts` (Worker route map + CORS).
5. `packages/web/src/lib/api-url.ts` + `packages/web/src/middleware.ts`.
6. `packages/extension/manifest.json` + `src/background/index.js` (behavior).
7. `packages/shared/src/index.js` (shared constants).

---

## Conventions to preserve

- **Do not** expose service role to browser; **do not** add client-writable policies for billing/staff fields without security review.
- **Stripe webhook** must receive **raw** body for signature verification.
- **Migrations:** always numbered SQL in `packages/api/src/db/migrations/` and update `.cursor/database-schema.md` when schema changes.
- Prefer **minimal, task-scoped** diffs; match existing style (ESM in API, TS in web/worker).
