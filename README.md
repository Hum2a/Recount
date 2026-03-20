# Recount

**Recount** implements the FocusTrack-style spec: a Chrome extension passively tracks time by domain, morning intentions, a **Node + Express API**, **Next.js 14** dashboard, **Supabase** auth/DB, **OpenAI** reports, and **Stripe** one-time licensing.

## Monorepo

| Package | Role |
|--------|------|
| `packages/shared` | Domain classification helpers |
| `packages/api` | Express API |
| `packages/extension` | Chrome MV3 extension |
| `packages/web` | Next.js App Router (marketing + dashboard) |

## Setup

1. **Node 20+**
2. Run **`001_init.sql`** then **`002_auth_profile_trigger.sql`** from `packages/api/src/db/migrations/` in the Supabase SQL editor.
3. Copy env files: `packages/api/.env.example` → `.env`, `packages/web/.env.example` → `.env.local`.
4. `npm install`

**API env (local):** With `NODE_ENV=development` (default), missing variables in `packages/api/.env` are filled with **dev placeholders** so `npm run dev:api` starts anyway — fine for working on the web UI. Auth, Stripe, OpenAI, and Resend stay broken until you add real keys. To require a full `.env` locally, set `RELAXED_ENV=0`.

## Scripts

```bash
npm run dev:api     # default :3001 — requires valid API .env
npm run dev:web     # :3000
npm run build:extension   # output: packages/extension/dist
```

If `next build` hits OOM on Windows:

```bat
set NODE_OPTIONS=--max-old-space-size=8192
npm run build -w @recount/web
```

## Extension

- **Dev**: load unpacked `packages/extension` from `chrome://extensions`.
- **Prod**: load `packages/extension/dist` after `npm run build:extension`.
- **Local vs store**: the extension uses `chrome.management.getSelf()` (`management` permission) to read `installType`. Unpacked loads use **`development`** → default API `http://localhost:3001`. Store installs use **`normal`** → default API `DEFAULT_API_URL_STORE` in `packages/extension/src/utils/constants.js` (set this to your real API before publishing). Override anytime under **Options** (leave URL blank to use the default for that install type).
- Add `chrome-extension://…` to API `ALLOWED_ORIGINS` when calling a deployed API.

## API routes (summary)

- `GET /health`
- `POST /api/auth/signup|login|refresh`
- `POST /api/events/batch`, `GET /api/events/summary`
- `POST /api/intentions`, `GET /api/intentions/:date`
- `POST /api/reports/generate`, `GET /api/reports/history`, `GET /api/reports/:date`
- `GET /api/profiles/me`, `PATCH /api/profiles`
- `POST /api/payments/create-session`, `GET /api/payments/status`, `POST /api/payments/webhook`

## Production API (live backend)

1. **Host the API over HTTPS** (e.g. Railway, Fly.io, Render, a VPS + reverse proxy). Point a domain at it, e.g. `https://api.yourdomain.com`.

2. **Deploy `packages/api` only** (monorepo: set the service **root directory** to `packages/api`, or build from repo root with install that includes workspaces, then `npm run start -w @recount/api`). Start command: **`node src/server.js`** (uses `PORT` from env, often set by the host to `3000` or `8080`).

3. **Production environment variables** — copy `packages/api/.env.example` and set **real** values (no placeholders):
   - **`NODE_ENV=production`** so the API does **not** use dev placeholder env (and Zod validation stays strict).
   - **`SUPABASE_*`** — same Supabase project as the web app; **service role** key only on the server, never in the client.
   - **`OPENAI_API_KEY`** — live key for reports.
   - **`STRIPE_*`** — use **`sk_live_…`**, live **`price_…`**, and a webhook signing secret from the **live** Stripe dashboard.
   - **`RESEND_API_KEY`** + **`FROM_EMAIL`** — verified sender domain in Resend.
   - **`WEB_URL`** — your **production** dashboard URL, e.g. `https://app.yourdomain.com` (Stripe success/cancel redirects).
   - **`ALLOWED_ORIGINS`** — comma-separated list of origins allowed by CORS, e.g.  
     `https://app.yourdomain.com,chrome-extension://YOUR_EXTENSION_ID`  
     After you publish the extension, copy its ID from `chrome://extensions` and add **`chrome-extension://<id>`** here so the extension can call the API. Include **`https://**` web origins only (no trailing slashes on origins).

4. **Stripe webhook (live)** — in Stripe Dashboard → Developers → Webhooks, add endpoint  
   `https://api.yourdomain.com/api/payments/webhook`,  
   event **`checkout.session.completed`**, and paste the signing secret into **`STRIPE_WEBHOOK_SECRET`**.

5. **Health check** — your monitor can hit **`GET /health`** (`{ "status": "ok" }`).

6. **Extension** — set **`DEFAULT_API_URL_STORE`** in `packages/extension/src/utils/constants.js` to the same public API base URL (no trailing slash), or rely on users setting Options.

7. **Supabase Auth** — in Supabase → Authentication → URL configuration, add your **production site URL** and redirect URLs if you use email links / OAuth.

## Stripe

Webhook: `POST /api/payments/webhook` (raw body). Event: `checkout.session.completed`. Set `STRIPE_PRICE_ID` to your one-time GBP price. Checkout **cancel** returns users to `/pricing?payment=cancelled` (set `WEB_URL` accordingly).

## Name

The specification used the name “FocusTrack”; this repo uses **Recount** as the product name.
