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

---

## P0 — Align & close obvious gaps

### SEC-001 — API worker auth weaker than Express API

- **Where:** `packages/api-worker/src/routes/auth.ts`
- **Issue:** Signup still uses `password: z.string().min(8)`; login returns `error.message` from Supabase; signup returns `error.message`. Main `packages/api` uses strong password policy + generic login errors.
- **Risk:** Deployed worker is a **bypass path** for weak passwords and richer login/signup error oracle vs Express.
- **Fix:** Mirror `packages/api/src/routes/auth.js` (strong password schema, generic login failure, strict bodies, consider login-event parity).

### SEC-002 — API worker job secret compare (timing)

- **Where:** `packages/api-worker/src/routes/jobs.ts` (`got !== secret`)
- **Issue:** Express API uses `timingSafeEqual` for `DIGEST_JOB_SECRET`; Worker uses string compare.
- **Risk:** Theoretical timing side-channel on job endpoint (low practical risk over internet; easy to align).
- **Fix:** Use timing-safe comparison in Worker (Web Crypto or constant-time compare pattern).

---

## P1 — Information disclosure & error handling

### SEC-003 — CORS failure → 500 + stack in logs

- **Where:** `packages/api/src/app.js` (cors callback throws), `errorHandler.js`
- **Issue:** Disallowed `Origin` becomes an error that maps to **500** “Internal server error” for the client; server logs full message.
- **Risk:** Confusing for clients; operational noise; not a direct data leak but poor security UX.
- **Fix:** Dedicated CORS error handler or `callback(null, false)` + optional `cors` options; return **403** without leaking policy details (or minimal body).

### SEC-004 — Signup / refresh error messages from provider

- **Where:** `packages/api/src/routes/auth.js` — signup still returns `error.message` from Supabase on failure; refresh returns `error?.message`
- **Issue:** Can leak whether an email exists / provider-specific strings.
- **Risk:** User enumeration, implementation detail leakage.
- **Fix:** Generic signup failure message where appropriate; generic refresh failure.

### SEC-005 — Stripe webhook error body

- **Where:** `packages/api/src/routes/payments.js` — `Webhook Error: ${err.message}` on signature failure
- **Issue:** Returns provider error text to caller (Stripe retries, but still observable).
- **Risk:** Low; tidy to constant “Invalid signature”.

### SEC-006 — Admin report patch: `top_domains` is `z.any()`

- **Where:** `packages/api/src/routes/admin.js` — `patchReportBody`
- **Issue:** Staff can send arbitrary JSON; stored and later consumed by clients.
- **Risk:** Oversized payloads, unexpected shapes breaking UI, edge-case prototype pollution if object merged unsafely anywhere (audit read paths).
- **Fix:** Strict Zod schema (array of `{ domain, seconds, category }` with max length / max nesting).

---

## P1 — Application security (auth / tokens / abuse)

### SEC-007 — Bearer tokens in extension `chrome.storage.local`

- **Where:** `packages/extension/src/utils/auth.js`, `api-client.js`
- **Issue:** Access + refresh tokens in extension storage; any extension or XSS in extension UI could theoretically read (MV3 still privileged, but phishing / malicious companion ext is a user-risk).
- **Risk:** Medium — standard for many extensions; document threat model.
- **Fix (longer term):** Prefer minimal token lifetime; rotation; optional `chrome.identity` / PKCE flows if Supabase supports; document “don’t install untrusted extensions.”

### SEC-008 — Rate limiting & proxy IP

- **Where:** `packages/api` — `express-rate-limit`, `recordLoginEvent` / `LOGIN_AUDIT_SALT`
- **Issue:** Behind reverse proxy, default client IP may be wrong unless `trust proxy` is set; rate limits may apply per proxy not per user.
- **Risk:** Brute-force or abuse patterns harder to throttle correctly; audit logs wrong IP bucket.
- **Fix:** Configure `app.set("trust proxy", …)` appropriately for deployment; optionally rate-limit per email+IP.

### SEC-009 — Payments `create-session` accepts any JSON body

- **Where:** `packages/api/src/routes/payments.js`
- **Issue:** No `validate(emptySchema)` / strict empty body — minor inconsistency.
- **Risk:** Low; extra keys ignored.
- **Fix:** `.strict()` empty body for consistency and future-proofing.

### SEC-010 — Webhook idempotency (Stripe)

- **Where:** `packages/api/src/routes/payments.js` — `checkout.session.completed`
- **Issue:** Retries could double-call side effects if not idempotent (upsert helps; verify payment row + profile update).
- **Risk:** Medium if partial failures exist — verify DB constraints and upsert keys.
- **Fix:** Document idempotency; use Stripe `event.id` dedupe table if needed.

---

## P2 — XSS, CSP, supply chain

### SEC-011 — Next.js CSP allows `unsafe-inline` + `unsafe-eval`

- **Where:** `packages/web/next.config.js`
- **Issue:** Weaker XSS mitigation; often required by Next.js legacy patterns but not ideal.
- **Risk:** Any XSS in app gets more leverage.
- **Fix:** Migrate toward nonce/hashed CSP when feasible; shrink `connect-src` to known API origins + Supabase.

### SEC-012 — AI prompt injection (reports)

- **Where:** `packages/api/src/services/openai.js` (and worker equivalent)
- **Issue:** User-controlled intentions + domain names embedded in model prompts; model could be manipulated (content policy / exfil-style prompts).
- **Risk:** Integrity of “accountability” text; possible policy violations in enterprise contexts.
- **Fix:** Structured prompts, delimiter escaping, output validation, optional second pass / template-only summaries for enterprise.

### SEC-013 — Dependency advisories (full monorepo)

- **Where:** Root `package-lock.json` / Next / OpenNext transitive tree
- **Issue:** `npm audit` previously reported high/critical in web stack; CI currently gates **API prod** deps only.
- **Risk:** Known vulns in build/runtime deps until upgraded.
- **Fix:** Scheduled upgrade PRs; separate non-blocking audit report job; bump OpenNext/Next when safe.

### SEC-014 — `JWT_SECRET` optional in API env schema

- **Where:** `packages/api/src/config/env.js`
- **Issue:** If unused, remove or document; if partially used, enforce in production.
- **Risk:** Confusion / dead config implying JWT validation that does not exist.

---

## P2 — Extension surface

### SEC-015 — `web_accessible_resources` exposes content scripts to all URLs

- **Where:** `packages/extension/manifest.json`
- **Issue:** By design for injected scripts; increases attack surface if script files ever contain secrets or logic bugs.
- **Risk:** Low if scripts are minimal static strings (current nudge scripts use `textContent` only — good).
- **Fix:** Keep scripts minimal; never pass tokens into page context; periodic review.

### SEC-016 — Extension “Dev” tab pings API paths

- **Where:** `packages/extension/src/popup/popup.js`
- **Issue:** Helps debugging but could encourage pasting tokens in logs (currently shows session expiry metadata).
- **Risk:** Low; developer-only visibility.
- **Fix:** Strip in production builds or gate behind privileged role only (already partially role-gated).

---

## P3 — RLS, operations, privacy

### SEC-017 — RLS migrations optional

- **Where:** Docs reference optional `010_rls_select_own_or_staff.sql`
- **Issue:** Without RLS, compromise of anon key + direct PostgREST is different risk profile than “API only writes.”
- **Risk:** Depends on how Supabase is exposed.
- **Fix:** Enable and verify RLS for production posture; never ship anon key with broad write in client.

### SEC-018 — Structured logging redaction

- **Where:** `packages/api/src/logger.js`, `errorHandler.js`
- **Issue:** `logger.error({ err }, …)` may include request bodies on some errors if libraries attach them.
- **Risk:** Rare token/PII in logs.
- **Fix:** Redact `Authorization` / cookie headers in serializers; avoid logging `req.body` on auth routes.

### SEC-019 — Calendar export `.ics` token in URL / auth

- **Where:** `GET /api/events/me/calendar.ics`
- **Issue:** If ever linked in `<img>` or shared, URLs with long-lived tokens are sensitive (currently session Bearer in header — OK).
- **Risk:** If changed to query-token calendar links in future — treat as secret URLs.
- **Fix:** If adding share links: opaque revocable tokens + TTL.

---

## Suggested order to tackle

1. **SEC-001** / **SEC-002** (worker parity)
2. **SEC-003** / **SEC-004** / **SEC-005** (disclosure cleanup)
3. **SEC-006** (admin schema)
4. **SEC-008** (trust proxy + limits)
5. **SEC-010** (Stripe idempotency review)
6. **SEC-011** / **SEC-012** (CSP + AI abuse)
7. Remaining as bandwidth allows

---

*Last sweep: 2026-03-27 (manual codebase review; not a substitute for professional pentest or DAST).*
