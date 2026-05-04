# Cloudflare-native deployment (Pages/Workers) for Recount

This guide sets up:

- **Web app** (`packages/web`) on **Cloudflare Workers** (OpenNext).
- **API** (`packages/api-worker`) on **Cloudflare Workers**.
- **Deploys via npm commands** from the repo root.

> **Windows:** `@recount/web` sets `WRANGLER_BUILD_*` (same as CI) for Wrangler. `next.config.js` turns off **production webpack disk cache** to avoid `PackFileCacheStrategy` rename `ENOENT` / misleading `PageNotFoundError: /_document` when the cache is corrupt. If a build still acts oddly, delete `packages/web/.next` and retry; OpenNext’s CLI may still recommend WSL — use **`deploy:web:cf:wsl`** or **GitHub Actions** if needed.

---

## 1) One-time prerequisites

1. Cloudflare account + domain on Cloudflare DNS.
2. Install dependencies:

```bash
npm install
```

3. Authenticate Wrangler once:

```bash
npx wrangler login
```

4. Set your Cloudflare account ID for both workers (either in env or wrangler config flow).

---

## 2) npm commands available

From repo root:

```bash
npm run dev:web
npm run deploy:web
npm run deploy:web:cf:wsl   # optional: same as deploy:web via WSL on Windows

npm run dev:api:worker
npm run deploy:api

npm run sync:cf:env
npm run deploy
```

What they call:

- `deploy` / `deploy:cf` -> sync secrets (unless skipped), `@recount/api-worker` deploy, then `@recount/web` deploy
- `deploy:web` / `deploy:web:cf` (alias) -> `@recount/web` script `deploy` (`opennextjs-cloudflare build` + deploy)
- `deploy:web:cf:wsl` -> run `deploy:web` inside WSL (Windows helper if you prefer Linux paths)
- `deploy:api` / `deploy:api:cf` (alias) -> `@recount/api-worker` script `deploy` (`npx wrangler deploy`)
- `sync:cf:env` -> push env values from local `.env` files to Cloudflare Worker secrets

`deploy` / `deploy:cf` toggles:

- `SKIP_CF_ENV_SYNC=1` -> skip secret sync step

For PowerShell:

```powershell
$env:SKIP_CF_ENV_SYNC = "1"
```

## 2.1) GitHub Actions deploy (recommended for Windows users)

This repo includes `.github/workflows/deploy-cloudflare.yml`.

- Triggers on:
  - push to `main`
  - manual run (`workflow_dispatch`)
- Runs on `ubuntu-latest` and executes:
  - `npm ci`
  - `npm run deploy:cf` (API worker + web worker)

### Required GitHub repository secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

The `NEXT_PUBLIC_*` values are used during the Next.js build in CI.

---

## 3) Configure web worker (`packages/web`)

The web package is wired for OpenNext Cloudflare:

- `npm run -w @recount/web cf:build` runs `opennextjs-cloudflare build`
- `npm run -w @recount/web deploy` builds + deploys via Wrangler
- `packages/web/wrangler.toml` and `packages/web/open-next.config.ts` are required when deploying web

### Required web environment variables (Cloudflare dashboard or Wrangler)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (your API worker URL, e.g. `https://api.yourdomain.com`)

Local sync source for these keys: `packages/web/.env.local` plus **`packages/web/.env.production`** (production values override local for `sync:cf:env`).

### Build-time `NEXT_PUBLIC_*` when deploying from your machine

`NEXT_PUBLIC_*` are embedded at **`next build`** time. Wrangler secrets alone do not fix a wrong client bundle if the build never saw the right values.

- Copy **`packages/web/.env.production.example`** to **`packages/web/.env.production`** and set real production URLs (especially **`NEXT_PUBLIC_API_URL`** = your API Worker `https://…` URL, not `localhost` and not `https://recount.world:3001`).
- **`npm run deploy:web`** runs `deploy-web-cf.mjs`, which injects **`.env.production`** and optional **`.env.deploy`** into the build environment so they take effect even when **`.env.local` is for dev** (Next normally lets `.env.local` win over `.env.production` when only reading files).
- GitHub Actions already sets the `NEXT_PUBLIC_*` repository secrets for CI builds.

Stale `_next/static/chunks/...` **404** often means an old HTML shell cached old chunk hashes — hard refresh or purge CDN cache after deploy.

---

## 4) Configure API worker (`packages/api-worker`)

`packages/api-worker/wrangler.toml` and `src/index.ts` are pre-added.

### Required API worker environment variables

Set as secrets/vars for `recount-api`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (**secret**)
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (**secret**)
- `OPENAI_REPORT_MODEL` (optional; default `gpt-4o-mini`)
- `REPORT_GENERATE_MAX_PER_UTC_DAY` (optional; default 15; requires DB migration 013)
- `STRIPE_SECRET_KEY` (**secret**)
- `STRIPE_PRICE_ID` (Lifetime Stripe Price id, e.g. £9.99 GBP — same mode as secret key)
- `STRIPE_WEBHOOK_SECRET` (**secret**)
- `RESEND_API_KEY` (**secret**)
- `FROM_EMAIL`
- `WEB_URL` (web origin)
- `ALLOWED_ORIGINS` (comma-separated, include web origin and extension origin when needed)
- `DIGEST_JOB_SECRET` (optional, secret)

Local sync source for these keys: `packages/api/.env` (`npm run sync:cf:env`).

Example secret set:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config packages/api-worker/wrangler.toml
```

For non-secret vars, set in the Cloudflare dashboard or add `[vars]` in `wrangler.toml` (avoid committing real values).

---

## 5) Domains and routing

Suggested:

- `app.yourdomain.com` -> `recount-web` worker
- `api.yourdomain.com` -> `recount-api` worker

Then set:

- Web `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- API `WEB_URL=https://app.yourdomain.com`
- Supabase Auth URL config with `https://app.yourdomain.com`
- Stripe webhook endpoint `https://api.yourdomain.com/api/payments/webhook`

---

## 6) API migration status

The following are now implemented in `packages/api-worker`:

- `/api/auth/*`
- `/api/events/*`
- `/api/intentions/*`
- `/api/reports/*`
- `/api/payments/*`
- `/api/profiles/*`
- `/api/admin/*`
- `/api/team/*`
- `/api/jobs/*`

Parity checks still recommended before production cutover:

- auth middleware (`Authorization: Bearer`)
- Stripe signature validation for webhook
- JSON/status code consistency for client error handling
- CORS (`ALLOWED_ORIGINS`)

---

## 7) Validation commands

```bash
npm run dev:api:worker
npm run dev:web
```

Smoke checks:

- `GET https://api.../health` -> `{ status: "ok" }`
- web app loads and uses API URL from `NEXT_PUBLIC_API_URL`
- no CORS errors from web origin

---

## 8) Notes

- Keep `packages/api` as migration reference until all routes are ported.
- Once worker routes are complete and stable, you can retire Node API deploy docs/infra.
