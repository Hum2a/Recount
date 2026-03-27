# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where applicable.

## [Unreleased]

### Added

- Professional repo metadata (README, community docs, issue templates, `LICENSE`).
- API security CI workflow and authorization + password policy tests.
- `TRUST_PROXY` / **`TRUST_PROXY_HOPS`** for Express behind reverse proxies; optional `timing-safe` job secret check on Cloudflare Worker.
- Migration **`011_stripe_webhook_events.sql`**: Stripe webhook dedupe by `event.id` (Express + Worker).
- CI job: informational `npm audit` for **`@recount/web`** prod dependencies.
- `packages/extension/SECURITY.md`: extension threat / surface notes.

### Changed

- Stronger signup password requirements (web, extension, API).
- Cloudflare Worker auth aligned with Express (password policy, generic auth errors, strict JSON bodies).
- CORS: disallowed origins no longer produce 500 responses.
- Stripe webhook: generic signature error text; strict checkout body; idempotent license + email; **`stripe_webhook_events`** ledger for retries.
- Admin report PATCH: validated `top_domains` and bounded goal arrays (Express + Worker).
- Cloudflare Worker payments: aligned with Express (create-session, webhook).
- API logger: header redaction for `req` / common `err.config` paths; `JWT_SECRET` documented as unused.
- Auth rate limits: keys use **client IP + email** (refresh uses IP + `refresh` bucket).
- Next.js CSP: tighter **`connect-src`**, no **`unsafe-eval`** in production.
- OpenAI report pipeline: bounded user payload, delimiter blocks, injection-aware system text, validated score/goal arrays (API + Worker).
- Extension Dev panel logs: best-effort redaction of bearer/refresh snippets.

<!-- ## [0.1.0] - YYYY-MM-DD -->
<!-- ### Added -->
<!-- - Initial public release. -->
