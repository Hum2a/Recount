# Improvements & technical debt backlog

Non-security (or **primarily product/DX/quality**) items to work through **one at a time**.  
Security-adjacent items that are mostly **quality** are listed here; pure security issues are in [`SECURITY_FINDINGS.md`](./SECURITY_FINDINGS.md).

---

## Legend

| Priority | Meaning |
|----------|---------|
| P1 | High user or maintainer impact |
| P2 | Medium — worth scheduling |
| P3 | Polish / opportunistic |

---

## P1 — Consistency between API surfaces

### IMP-001 — Parity: Express API vs Cloudflare Worker (`api-worker`)

- **Where:** `packages/api` vs `packages/api-worker`
- **Issue:** Auth validation, error shapes, rate limits, and middleware may drift (password policy already differs).
- **Improvement:** Shared Zod schemas or codegen from one source; integration tests against both mounts; doc *single* canonical behavior.

### IMP-002 — Shared password policy module

- **Where:** `packages/web` signup UI, `packages/extension` popup, `packages/api`, `packages/api-worker`
- **Issue:** Four copies of rules; easy to drift.
- **Improvement:** `packages/shared` export `passwordPolicy` (regex + messages) or tiny `packages/auth-schema` workspace package.

---

## P1 — Testing & quality gates

### IMP-003 — API test coverage beyond authz + password

- **Where:** `packages/api/src/routes/__tests__/`
- **Issue:** Most routes lack automated tests (admin RBAC, team leaderboard, jobs).
- **Improvement:** Route-level tests with mocks; contract tests for critical paths.
- **Progress:** Stripe **`checkout.session.completed`** webhook covered in `payments.webhook.test.js` (dedupe, license email, signature failure).

### IMP-004 — Web / component tests

- **Where:** `packages/web`
- **Issue:** No Vitest/RTL/Playwright visible in repo for UI flows.
- **Improvement:** Smoke E2E for login → dashboard; or RTL for settings form validation.

### IMP-005 — Monorepo lint/typecheck in CI

- **Where:** `.github/workflows`
- **Issue:** Root `tsc --noEmit` for all packages may still be missing on every PR.
- **Progress:** `ci-security.yml` includes **Web lint + production build** (`web-lint-build` job).
- **Improvement:** Optional strict TypeScript check for `packages/api` or shared packages when migrated.

---

## P2 — Code quality & maintainability

### IMP-006 — Strict validation on all mutating routes

- **Where:** Various `packages/api/src/routes/*.js` (e.g. payments `create-session`, events activity query-only parsers)
- **Issue:** Some routes rely on ad-hoc parsing instead of unified `validate()` middleware.
- **Improvement:** Standardize on `validate(schema, 'body'|'query'|'params')` + `.strict()` for JSON bodies.

### IMP-007 — Admin `patchIntentionBody` goals array

- **Where:** `packages/api/src/routes/admin.js`
- **Issue:** `goals: z.array(z.string())` — no max length / count vs user-facing intentions limits.
- **Improvement:** Match `intentions` route limits (max goals, max string length).

### IMP-008 — Centralize Supabase error → HTTP mapping

- **Where:** Routes repeat `error.message` from PostgREST.
- **Issue:** Noisy client errors; inconsistent status codes.
- **Improvement:** Small helper maps known Postgres/Supabase codes to 409/404/400.

### IMP-009 — TypeScript migration for API (incremental)

- **Where:** `packages/api` (JavaScript)
- **Issue:** No compile-time checks on routes vs Zod inferred types.
- **Improvement:** `allowJs` + `checkJs` or migrate `routes/` to `.ts` file-by-file.

### IMP-010 — Extension: share password policy with shared package

- **Related:** IMP-002
- **Issue:** Duplicate `getPasswordPolicyFailures` vs web checklist.

---

## P2 — Performance & reliability

### IMP-011 — Batch event insert size vs DB limits

- **Where:** `POST /api/events/batch` (max 500)
- **Issue:** Large batches may hit statement timeout or payload limits on some hosts.
- **Improvement:** Tunable limit per env; chunked insert server-side if needed.

### IMP-012 — OpenAI report generation resilience

- **Where:** `packages/api/src/services/openai.js`
- **Issue:** Timeouts, retries, partial failures UX (extension popup already warns duration).
- **Improvement:** Exponential backoff; job queue for slow paths; user-visible job status.

### IMP-013 — Dashboard data fetching patterns

- **Where:** `packages/web` server components + client fetch
- **Issue:** Possible duplicate fetches or waterfall without auditing.
- **Improvement:** React `cache()` / single data layer for dashboard shell.

---

## P3 — DX & documentation

### IMP-014 — Single “local dev” docker-compose (optional)

- **Issue:** New contributors juggle Supabase cloud + many env vars.
- **Improvement:** Optional `docker-compose` for Postgres + local stub (if license allows) — **or** scripted `vercel env pull` style doc only.

### IMP-015 — API OpenAPI / typed client

- **Issue:** No machine-readable OpenAPI spec for extension/other clients.
- **Improvement:** Generate OpenAPI from Zod (e.g. `@asteasolutions/zod-to-openapi`) or hand-maintained `openapi.yaml`.

### IMP-016 — Changelog automation

- **Where:** [`CHANGELOG.md`](../CHANGELOG.md)
- **Issue:** Manual upkeep.
- **Improvement:** Release Please, changesets, or enforce PR title convention + automated notes.

### IMP-017 — README architecture diagram vs reality

- **Where:** [`README.md`](../README.md) mermaid
- **Improvement:** When `api-worker` becomes primary, update diagram + “source of truth” narrative.

### IMP-018 — `.env.example` drift

- **Where:** `packages/api/.env.example`, `packages/web/.env.example`
- **Improvement:** CI check that `env.js` / Zod schema keys match `.env.example` (script).

---

## P3 — Product / UX (security-adjacent but mainly UX)

### IMP-019 — Signup confirmation flow messaging

- **Where:** Web signup, extension signup when `session` missing
- **Issue:** Email confirmation flows may confuse users (“Check your email” vs errors).
- **Improvement:** Unified copy; link to resend confirmation if Supabase supports.

### IMP-020 — Free-tier date window clarity

- **Where:** Activity APIs + UI copy
- **Improvement:** Explicit UTC vs local tooltip everywhere dates appear (partially done in extension).

---

## Suggested order

1. **IMP-001** / **IMP-002** (single source of truth for API + passwords)
2. **IMP-005** (CI lint/build)
3. **IMP-003** (API tests expansion)
4. **IMP-006** / **IMP-007** (validation consistency)
5. **IMP-011**–**IMP-013** as usage grows
6. **IMP-015**–**IMP-018** for contributor experience

---

*Last sweep: 2026-03-27.*
