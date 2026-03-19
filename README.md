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
- Set **API base URL** under extension options (default `http://localhost:3001`). Add `chrome-extension://…` to API `ALLOWED_ORIGINS` when calling a deployed API.

## Stripe

Webhook: `POST /api/payments/webhook` (raw body). Event: `checkout.session.completed`. Set `STRIPE_PRICE_ID` to your one-time GBP price.

## Name

The specification used the name “FocusTrack”; this repo uses **Recount** as the product name.
