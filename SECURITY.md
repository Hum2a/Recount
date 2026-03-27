# Security policy

## Supported versions

Recount is under active development. Security fixes are applied to the default
branch (`main`) and released as tags or deploys according to maintainer
practice. There is no separate LTS line at this time.

| Version / branch | Supported |
|------------------|-----------|
| `main`           | Yes       |
| Older tags       | Best effort — prefer upgrading |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for undisclosed security
vulnerabilities.

1. Open a **private security advisory** via GitHub (**Security** tab →
   *Report a vulnerability*), **or**
2. Email maintainers with a clear subject line (e.g. `[SECURITY] Recount`) and
   encrypted detail if you use PGP (optional).

Include:

- Description of the issue and impact
- Steps to reproduce (or proof of concept if safe)
- Affected components (web, API, extension, infra)
- Suggested fix (optional)

We aim to acknowledge reports within **72 hours** and coordinate disclosure
after a fix is available.

## Security hardening (maintainers & contributors)

Operational checklist and verification notes live in
[`SECURITY_HARDENING.md`](./SECURITY_HARDENING.md).

CI security workflow: [`.github/workflows/ci-security.yml`](./.github/workflows/ci-security.yml).

## Scope notes

- Out of scope: social engineering of users, physical access to devices,
  issues in third-party services unless directly caused by this repository’s
  integration (we may still forward reports).

**Chrome extension:** threat model and surface notes: [`packages/extension/SECURITY.md`](./packages/extension/SECURITY.md).

Thank you for helping keep Recount users safe.
