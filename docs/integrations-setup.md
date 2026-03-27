# Recount — integrations & setup guide

Use this when wiring **production** (or full **local**) environments. Shared platforms are described **once**; a matrix at the end maps **each product feature** to what you must configure.

**Packages involved:** `packages/web` (Next.js), `packages/api` (Express), `packages/extension` (Chrome MV3), Supabase project (auth + Postgres).

---

## 1. Quick reference — external services

| Integration | Used for | Required env / config |
|-------------|----------|------------------------|
| **Supabase** | Auth, database, RLS, user profiles | Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. API: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Your API host** | All REST logic, Stripe webhook, AI, email jobs | Deploy `packages/api`; set full `packages/api/.env` (see §3) |
| **Your web host** | Marketing + dashboard (Next.js) | Deploy `packages/web`; `NEXT_PUBLIC_*` + `NEXT_PUBLIC_API_URL` |
| **Stripe** | Lifetime checkout, `license_active` | API: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` + dashboard webhook |
| **OpenAI** | AI accountability reports (licensed users) | API: `OPENAI_API_KEY` |
| **Resend** | Weekly digest email (opt-in users) | API: `RESEND_API_KEY`, `FROM_EMAIL` (verified domain) + optional `DIGEST_JOB_SECRET` + cron |
| **Google Chrome Web Store** (optional) | Distributing the extension | Publisher account, listing, then extension ID → `ALLOWED_ORIGINS` |

**Already in-repo (not SaaS):** SQL migrations under `packages/api/src/db/migrations/`, extension `manifest.json` / options UI.

---

## 2. Supabase (almost every feature)

**Powers:** sign-up / login / sessions (web + extension-backed flows), `profiles` and all app data the API reads/writes with the service role, RLS for client-safe reads where configured. For production posture, run **`010_rls_select_own_or_staff.sql`** (with earlier migrations, especially **`005_rls_least_privilege_grants.sql`**).

### Steps

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL:** Run migrations **in order** from `packages/api/src/db/migrations/` in the Supabase SQL editor (see root `README.md`; includes `010` RLS hardening and `011` Stripe webhook dedupe).
3. **API keys:** Settings → API → copy **Project URL**, **anon public**, and **service_role** (keep service role **server-only**).
4. **Auth URLs:** Authentication → URL configuration → set **Site URL** and redirect URLs to your production web origin (e.g. `https://app.yourdomain.com`) and local dev if needed.
5. **Web env** (`packages/web/.env.local`):  
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (your API base, no trailing slash).
6. **API env** (`packages/api/.env`):  
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (same project as web).

**First admin (staff UI):** in SQL:  
`UPDATE public.profiles SET app_role = 'admin' WHERE email = 'you@example.com';`

---

## 3. Recount API (Express) — shared backbone

**Powers:** Tab event ingest, intentions, summaries, activity, reports orchestration, profile patches, admin routes, Stripe webhook, OpenAI calls, Resend sends, weekly-digest job.

### Steps

1. **Install / run locally:** from repo root, `npm install`; `npm run dev:api` (default port **3001**). Use `packages/api/.env` from `.env.example`.
2. **Production:** deploy **`packages/api` only** (see `README.md`). Start: `node src/server.js` (or workspace script). Set **`NODE_ENV=production`** so env validation is strict.
3. **CORS:** `ALLOWED_ORIGINS` = comma-separated origins, **no trailing slashes**, e.g.  
   `https://app.yourdomain.com,chrome-extension://YOUR_EXTENSION_ID`
4. **Web URL:** `WEB_URL` = same origin users use for the Next app (Stripe success/cancel redirects and email links).
5. **Optional:** `JWT_SECRET` is unused by current Recount code (Supabase JWTs only); you may omit it. **`DIGEST_JOB_SECRET`** (≥16 chars) if you run the weekly digest job (§7).

---

## 4. Next.js web app

**Powers:** Marketing pages, dashboard UI, Supabase session (middleware refresh), calls to API with user JWT.

### Steps

1. Copy `packages/web/.env.example` → `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (production API URL in prod).
3. Deploy the **`packages/web`** app; ensure Supabase **Site URL** matches this deployment’s origin.

---

## 5. Stripe (Lifetime license)

**Powers:** Checkout on `/pricing`, webhook sets `profiles.license_active` → full history, AI reports, wider export windows, etc.

### Steps

1. [Stripe Dashboard](https://dashboard.stripe.com) → create a **one-time Price** (e.g. GBP £14.99) → copy **Price ID** (`price_…`).
2. API env: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`.
3. **Webhook:** Developers → Webhooks → add endpoint  
   `https://<your-api-host>/api/payments/webhook`  
   - Event: **`checkout.session.completed`**  
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`.
4. Ensure **`WEB_URL`** matches where users return after pay/cancel (`/dashboard?payment=success`, `/pricing?payment=cancelled`).
5. **Dedupe table:** run migration **`011_stripe_webhook_events.sql`** so Stripe retries use a stable `event.id` ledger (Express and Worker webhooks both rely on it).

**Test mode:** use `sk_test_…`, test price, and Stripe CLI or test webhook secret for local webhook testing.

---

## 6. OpenAI (AI accountability reports)

**Powers:** `POST /api/reports/generate` and related report endpoints for **licensed** users only.

### Steps

1. [OpenAI Platform](https://platform.openai.com) → API keys → create a secret key.
2. API env: `OPENAI_API_KEY=sk-…`
3. Ensure billing/limits are acceptable for your traffic; model choice lives in API code (`packages/api/src/services/openai.js`).

**Without this:** report generation fails; rest of app can work on Free/Lifetime non-AI features.

---

## 7. Resend + weekly digest job

**Powers:** Email sending for **weekly digest** (users who opt in in Settings). Sending is via Resend; **delivery** only happens if something calls the job route on a schedule.

### Steps (email)

1. [Resend](https://resend.com) → verify your **sending domain** (DNS records).
2. API env: `RESEND_API_KEY`, `FROM_EMAIL` (address on verified domain, e.g. `digest@yourdomain.com`).
3. `WEB_URL` must be correct so links in mail point at your dashboard.

### Steps (scheduled job)

1. API env: set `DIGEST_JOB_SECRET` to a long random string.
2. Configure your host **cron** or scheduler to **POST** to  
   `https://<your-api-host>/api/jobs/weekly-digest`  
   with header **`X-Recount-Job-Secret: <same value>`**  
   (see `packages/api/src/routes/jobs.js`).
3. If `DIGEST_JOB_SECRET` is unset, the endpoint returns **503** (digest disabled).

**Without Resend:** digest emails do not send. **Without cron:** opt-in users never receive mail even if Resend is configured.

---

## 8. Chrome extension (distribution & API access)

**Powers:** Passive tracking, popup, options, nudges, alarms — talks to **your API** with user credentials / tokens as implemented in the extension.

### Steps (development)

1. `chrome://extensions` → **Load unpacked** → `packages/extension` (or `dist` after `npm run build:extension`).
2. Grant **site access** when prompted (Options) so `http(s)://*/*` tracking works.
3. API `ALLOWED_ORIGINS` must include **`http://localhost:3000`** (web) for local; extension calls API from extension context — for **published** builds add **`chrome-extension://<id>`**.

### Steps (production / store)

1. Create a **Chrome Web Store** developer account; pay one-time fee if required.
2. Set **`DEFAULT_API_URL_STORE`** and **`DEFAULT_WEB_URL_STORE`** in `packages/extension/src/utils/constants.js` to production API and web URLs (or rely on user Options).
3. Build `packages/extension/dist`, zip, submit listing.
4. After approval, copy extension **ID** from `chrome://extensions` → add  
   `chrome-extension://<id>`  
   to API **`ALLOWED_ORIGINS`** (comma-separated).

**Not a cloud “integration”:** OS notification / alarm APIs are local to Chrome; no extra keys.

---

## 9. Feature → what you must wire

| Feature area | Integrations / setup |
|--------------|----------------------|
| **Account, web dashboard & browser extension** | Supabase §2, API §3, Web §4, Extension §8, `ALLOWED_ORIGINS` + `WEB_URL` |
| **Passive tab tracking, blocklist, intentions, overview, streaks, Pomodoro, intent lock, privacy toggles, profile settings** | Supabase §2, API §3, Web §4, Extension §8 (site access for tracking) |
| **Activity, per-day summaries, history chart, CSV / ICS exports** | Same as above; **export windows** enforced in API by **`license_active`** (Stripe §5) |
| **AI accountability reports** | Everything above + **OpenAI** §6 + **Stripe** (or manual `license_active`) for licensed users |
| **Lifetime purchase / unlock** | **Stripe** §5 |
| **Team leaderboard** | Supabase + API + Web (no extra vendor) |
| **Weekly digest email** | **Resend** §7 + **`DIGEST_JOB_SECRET`** + cron POST to job route |
| **End-of-day reminder (extension)** | Extension only (Chrome alarms / notifications); ensure site access where needed |
| **Staff / admin dashboard** | Supabase role on `profiles.app_role` + same Web/API auth flow |

---

## 10. Suggested order of operations

1. Supabase project + migrations §2  
2. API `.env` (Supabase keys + `WEB_URL` + `ALLOWED_ORIGINS` for local web) §3  
3. Web `.env.local` + run web + verify login §4  
4. Extension local load + confirm events hit API §8  
5. Stripe test mode + webhook + test checkout §5  
6. OpenAI key + test report generate §6  
7. Resend + `FROM_EMAIL` + optional digest cron + `DIGEST_JOB_SECRET` §7  
8. Production deploys; swap live Stripe/OpenAI keys; add production `chrome-extension://…` origin §8  

---

## 11. Env file templates

- **API:** `packages/api/.env.example`  
- **Web:** `packages/web/.env.example`  

For strict local parity with production, set `RELAXED_ENV=0` when running the API (see root `README.md`).

---

*Generated from the Recount monorepo layout and `packages/api` / `packages/web` configuration. If code changes, reconcile env names with `packages/api/src/config/env.js` and `packages/web/.env.example`.*
