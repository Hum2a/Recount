# Contributing to Recount

Thanks for helping improve Recount. This document explains how we work in this monorepo and what we expect from contributions.

## Ground rules

- Be respectful — see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- Prefer **small, focused PRs** over large rewrites unless agreed upfront.
- **Do not commit secrets** (API keys, `.env`, tokens). Use `.env.example` patterns only.

## Getting started

1. Fork and clone the repository.
2. Install dependencies: `npm install` (from repo root; npm workspaces).
3. Configure environment files per [`README.md`](./README.md) → *Quick start*.
4. Run what you changed locally (API, web, extension build).

## Development commands (cheat sheet)

| Area | Command |
|------|---------|
| API | `npm run dev:api` |
| Web | `npm run dev:web` |
| API tests | `npm run test -w @recount/api` |
| Web lint | `npm run lint -w @recount/web` |
| Extension build | `npm run build:extension` |

## Pull requests

- Open a PR against the default branch (usually `main`).
- Use the [pull request template](.github/pull_request_template.md) (GitHub will pre-fill it).
- Link related issues with `Fixes #123` or `Refs #123` in the PR description where applicable.
- Ensure CI checks pass (security workflow runs tests and scans when enabled on the fork).

## Code style

- Match existing patterns in the package you touch (imports, formatting, naming).
- For TypeScript/React (`packages/web`), follow existing ESLint rules.
- For the API (`packages/api`), keep route handlers thin; validate inputs with Zod where the codebase already does.

## Security

- Report vulnerabilities privately — see [`SECURITY.md`](./SECURITY.md).
- Hardening notes for maintainers: [`SECURITY_HARDENING.md`](./SECURITY_HARDENING.md).

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project — see [`LICENSE`](./LICENSE).
