# Security findings & hardening backlog

Tracked items to close **one at a time**. Severity is **relative** (not a formal pentest).  
**Done items** live in [`SECURITY_HARDENING.md`](../SECURITY_HARDENING.md).

---

## Legend

| Priority | Meaning |
|----------|---------|
| P0 | Fix before broad production / high exploitability |
| P1 | Important; schedule soon |
| P2 | Hardening / defense in depth |
| P3 | Nice to have |

### Recently addressed (implementation pass — 2026-03-27)

| ID | What changed |
|----|----------------|
| **SEC-001** | Worker auth mirrors Express: strong password schema, `.strict()` request bodies, generic signup/login/refresh errors. |
| **SEC-002** | Worker weekly-digest: `timingSafeStringEqual` in `packages/api-worker/src/timing-safe.ts`. |
| **SEC-003** | Express CORS uses `callback(null, false)` for disallowed origins (no thrown error / 500 from CORS). |
| **SEC-004** | Express signup + refresh return generic messages; details only in server logs. |
| **SEC-005** | Stripe webhook verification failures return a constant message (no `err.message` in body). |
| **SEC-006** | Admin report PATCH: typed `top_domains` array + bounded `goals_met` / `goals_missed` (API + Worker). |
| **SEC-007** | Extension threat model documented in [`packages/extension/SECURITY.md`](../packages/extension/SECURITY.md). |
| **SEC-008** | `TRUST_PROXY` + **`TRUST_PROXY_HOPS`** (1–10, default 1); auth routes rate-limited by **IP + email** (refresh: IP + `refresh`). |
| **SEC-009** | `POST …/payments/create-session` validates strict empty JSON (Express + Worker). |
| **SEC-010** | Stripe `event.id` dedupe via **`stripe_webhook_events`** (migration `011`); early return on replay; row inserted after successful `checkout.session.completed` handling (Express + Worker). |
| **SEC-011 tighter** | Next.js CSP: **`connect-src`** limited to `'self'` + `NEXT_PUBLIC_SUPABASE_*` / `NEXT_PUBLIC_API_URL` origins (+ matching `wss:`); **`unsafe-eval`** only in development. |
| **SEC-012** | AI prompts: delimiter blocks, control-char / length bounds, system instructions to ignore in-band injection; clamp score + sanitize goal arrays. |
| **SEC-013** | CI: non-blocking **`npm audit`** for `@recount/web` prod deps (`dependency-audit-web-report` job). |
| **SEC-014** | `JWT_SECRET` documented as unused (Supabase JWTs); `.env.example` treats it as optional/omittable. |
| **SEC-015** | Nudge scripts / WAR surface called out in `packages/extension/SECURITY.md` (keep minimal, no tokens in page). |
| **SEC-016** | Popup Dev log: best-effort redaction of `Bearer` and `refresh_token` in logged snippets. |
| **SEC-017** | Production RLS path highlighted in [`docs/integrations-setup.md`](./integrations-setup.md) (`005` + `010`). |
| **SEC-018** | Pino: redact auth/cookie header paths; `req` serializer strips sensitive headers when `req` is logged. |
| **SEC-019** | Calendar `.ics` route documents Bearer-only auth; guidance if share URLs are added later. |

---

## P0 — Align & close obvious gaps

_(SEC-001, SEC-002 — **done**; see table above.)_

---

## P1 — Information disclosure & error handling

_(SEC-003 through SEC-006 — **done**; see table above.)_

---

## P1 — Application security (auth / tokens / abuse)

### ~~SEC-007~~ — Bearer tokens in extension — **done** (documentation)

- **Resolution:** [`packages/extension/SECURITY.md`](../packages/extension/SECURITY.md) describes storage and install trust.

### ~~SEC-008~~ — Rate limiting & proxy IP — **done**

- **Resolution:** `TRUST_PROXY_HOPS`; composite auth limiter keys.

### ~~SEC-009~~ — Payments `create-session` body — **done**

### ~~SEC-010~~ — Webhook idempotency (Stripe) — **done**

- **Resolution:** Table `stripe_webhook_events` + handler logic (see migration `011`).

---

## P2 — XSS, CSP, supply chain

### ~~SEC-011~~ — Next.js CSP — **improved**

- **Remaining (future):** nonces / hashed static scripts if Next.js stack allows removing `'unsafe-inline'` entirely.

### ~~SEC-012~~ — AI prompt injection — **mitigated**

- **Remaining (future):** optional template-only summaries for enterprise; second-pass validator model.

### ~~SEC-013~~ — Dependency advisories (full monorepo) — **partially done**

- **Done:** Informational web prod audit in CI.
- **Remaining:** Scheduled dependency upgrades; tighten web audit to blocking when the tree is clean enough.

### ~~SEC-014~~ — `JWT_SECRET` optional — **done**

---

## P2 — Extension surface

### ~~SEC-015~~ — `web_accessible_resources` — **documented**

### ~~SEC-016~~ — Extension Dev tab — **mitigated**

- **Resolution:** Log redaction helper in `popup.js`.

---

## P3 — RLS, operations, privacy

### ~~SEC-017~~ — RLS migrations — **documented**

- **Resolution:** `integrations-setup.md` calls out `005` + `010` for production.

### ~~SEC-018~~ — Structured logging redaction — **done**

### ~~SEC-019~~ — Calendar `.ics` — **documented**

- **Resolution:** Comment on route; no query-token auth today.

---

## Suggested order to tackle next

1. **Dependency upgrades** (web stack, OpenNext/Next) when advisories allow — make CI web audit blocking
2. **CSP:** nonce-based `script-src` when feasible
3. **SEC-007 long-term:** shorter token lifetimes / platform OAuth if product needs it
4. **Enterprise AI:** template-only or constrained output pipelines

---

*Last sweep: 2026-03-27 (manual codebase review; not a substitute for professional pentest or DAST).*
