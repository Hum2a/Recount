# Recount Security Hardening Checklist

This is a repo-specific hardening checklist for `packages/web`, `packages/api`, and `packages/extension`.

## What is already implemented

- API:
  - `helmet` enabled and tightened with `referrerPolicy`, CSP explicitly disabled for API responses.
  - CORS uses explicit allowlist validation from `ALLOWED_ORIGINS` with credentials enabled.
  - `x-powered-by` disabled.
  - JSON body size limit reduced to `64kb`.
  - Auth endpoint rate limiting already present (`authLimiter`).
  - Login now returns generic invalid-credentials errors.
  - Auth payload schemas are strict (`zod.strict()`).
  - Route validation now supports `params` in addition to body/query.
  - `intentions`, `reports`, and event-delete routes use schema-based param validation.
  - Scheduled job secret check now uses constant-time comparison.
  - Added executable authorization regression tests for user-scoped routes (`vitest` + `supertest`).
- Web (Next.js):
  - Global security headers configured in `next.config.js`:
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy` baseline
    - Baseline CSP
- Extension:
  - Background message handler now validates sender identity and message shape.
  - API/Web URL overrides in options are now normalized and restricted to:
    - `https://` origins
    - localhost loopback for local development only

## Next high-priority actions

1. Cookie/session model review
- Current API uses bearer tokens from web/extension.
- Keep access tokens short-lived, ensure refresh token rotation and revocation in Supabase configuration.
- Add explicit sign-out endpoint that revokes refresh tokens server-side where possible.

2. CSRF policy decision
- If browser app ever moves to cookie-authenticated API requests, add CSRF tokens for state-changing routes.
- For current bearer-token model, maintain strict CORS and origin checks.

3. Authorization consistency tests
- Add endpoint tests that verify user A cannot access/modify user B resources.
- Cover `/api/events`, `/api/reports`, `/api/intentions`, `/api/team`, and admin routes.

4. Security logging and alerting
- Track failed logins, unusual refresh patterns, and repeated 401/403 bursts.
- Ensure logs never include access/refresh tokens.

5. Dependency and secret scanning in CI
- Add:
  - `npm audit --workspaces` (or equivalent SCA gate)
  - secret scanning (gitleaks/trufflehog or platform-native scanner)
- Fail CI on critical vulnerabilities/secrets.
  - Implemented in `.github/workflows/ci-security.yml` with:
    - API authorization regression tests (`npm run test -w @recount/api`)
    - dependency audit gate (`npm audit --audit-level=high --omit=dev --workspace @recount/api`)
    - `gitleaks` secret scanning

6. Extension permission minimization
- Re-audit whether `tabs` + `webNavigation` are both strictly required for all flows.
- Keep host access optional and avoid broad always-on host permissions.

## Verification checklist

- [x] Requests from non-allowlisted origins are blocked by API CORS.
- [x] Login failures return generic errors only.
- [x] Oversized JSON payloads are rejected.
- [x] Next.js responses include configured security headers.
- [x] Extension rejects untrusted runtime message senders.
- [x] Invalid extension API/Web URL overrides are rejected in options UI.
