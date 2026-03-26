# Cloudflare-native deployment (Pages/Workers) for Recount

This guide sets up:

- **Web app** (`packages/web`) on **Cloudflare Workers** (OpenNext).
- **API** (`packages/api-worker`) on **Cloudflare Workers**.
- **Deploys via npm commands** from the repo root.

> Current status in this repo: API Worker routes are fully migrated. On Windows, `npm run deploy:cf` deploys API and intentionally skips web deploy unless forced (`FORCE_WINDOWS_WEB_DEPLOY=1`) because OpenNext has a known path-resolution issue on Windows.

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
npm run deploy:web:cf
npm run deploy:web:cf:wsl

npm run dev:api:worker
npm run deploy:api:cf

npm run sync:cf:env
npm run deploy:cf
```

What they call:

- `deploy:web:cf` -> `@recount/web` script `deploy` (`opennext build` + `wrangler deploy`)
- `deploy:web:cf:wsl` -> run `deploy:web:cf` inside WSL (Windows helper)
- `deploy:api:cf` -> `@recount/api-worker` script `deploy` (`wrangler deploy`)
- `sync:cf:env` -> push env values from local `.env` files to Cloudflare Worker secrets
- `deploy:cf` -> sync env, deploy API Worker, then deploy web when runtime supports it

`deploy:cf` behavior toggles:

- `SKIP_CF_ENV_SYNC=1` -> skip secret sync step
- `FORCE_WINDOWS_WEB_DEPLOY=1` -> attempt web deploy on Windows anyway (normally blocked)

For PowerShell, set env vars like:

```powershell
$env:FORCE_WINDOWS_WEB_DEPLOY = "1"
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

Local sync source for these keys: `packages/web/.env.local` (`npm run sync:cf:env`).

---

## 4) Configure API worker (`packages/api-worker`)

`packages/api-worker/wrangler.toml` and `src/index.ts` are pre-added.

### Required API worker environment variables

Set as secrets/vars for `recount-api`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (**secret**)
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (**secret**)
- `STRIPE_SECRET_KEY` (**secret**)
- `STRIPE_WEBHOOK_SECRET` (**secret**)
- `STRIPE_PRICE_ID`
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
