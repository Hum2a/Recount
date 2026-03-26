# Cloudflare-native deployment (Pages/Workers) for Recount

This guide sets up:

- **Web app** (`packages/web`) on **Cloudflare Workers** (OpenNext Cloudflare adapter).
- **API** (`packages/api-worker`) on **Cloudflare Workers**.
- **Deploys via npm commands** from the repo root.

> Current status in this repo: worker infrastructure and deploy commands are ready. The API Worker currently includes `/health` plus explicit `501 Not migrated yet` placeholders for `/api/*` routes until route migration from `packages/api/src/routes` is completed.

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

npm run dev:api:worker
npm run deploy:api:cf

npm run deploy:cf
```

What they call:

- `deploy:web:cf` -> `@recount/web` script `deploy` (`opennext build` + `wrangler deploy`)
- `deploy:api:cf` -> `@recount/api-worker` script `deploy` (`wrangler deploy`)
- `deploy:cf` -> deploy API Worker, then web Worker

---

## 3) Configure web worker (`packages/web`)

The web package is wired for OpenNext Cloudflare:

- `npm run -w @recount/web cf:build` runs `opennextjs-cloudflare build`
- `npm run -w @recount/web deploy` builds + deploys via Wrangler
- `packages/web/wrangler.toml` points to `.open-next/worker.js`

### Required web environment variables (Cloudflare dashboard or Wrangler)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (your API worker URL, e.g. `https://api.yourdomain.com`)

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

## 6) Route migration checklist (Express -> Worker)

Source routes to port:

- `packages/api/src/routes/auth.js`
- `packages/api/src/routes/events.js`
- `packages/api/src/routes/intentions.js`
- `packages/api/src/routes/reports.js`
- `packages/api/src/routes/payments.js`
- `packages/api/src/routes/profiles.js`
- `packages/api/src/routes/admin.js`
- `packages/api/src/routes/team.js`
- `packages/api/src/routes/jobs.js`

Recommended order:

1. `auth`, `profiles`, `intentions`
2. `events`, `reports`
3. `payments` (Stripe checkout + raw webhook verification)
4. `team`, `jobs`
5. `admin`

Keep behavior parity for:

- auth middleware (`Authorization: Bearer`)
- rate limit semantics
- JSON/error shapes used by web app and extension
- Stripe signature validation for webhook
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
