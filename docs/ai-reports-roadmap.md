# AI reports — roadmap

End state: **licensed users** get a reliable, discoverable **daily accountability report** (intentions vs tab time) with clear feedback when generation is slow or fails.

## Phase 1 — Core UX + API hardening

- [x] **Generate for any date (web):** `GenerateReportButton` supports arbitrary `date`; report detail page shows a **Generate** CTA when no report exists.
- [x] **After success:** navigate to `/dashboard/reports/{date}` so the new report is visible immediately.
- [x] **Reports list:** quick “generate today” when licensed (server provides today’s UTC date).
- [x] **OpenAI client:** per-request-friendly **timeout** and **retries** on the official SDK client (Express + Worker).
- [x] **Tests:** `POST /api/reports/generate` happy path with mocked Supabase + OpenAI.

## Phase 2 — Resilience & observability

- [x] **Timeouts / slow runs surfaced in UI:** after ~15s, web shows **“Still working…”** + guidance (~90s); extension copy updated.
- [x] **Structured errors:** `mapReportOpenAIError` (Express + Worker) maps rate limits, timeouts, 5xx, and misconfig to safe `{ error, code }`; server logs `openaiRequestId` + status when present.
- [x] **Client abort (95s):** web `fetch` and extension `apiFetch` pass an `AbortSignal` so hung connections end ~5s after the server’s 90s OpenAI budget; user copy points to **Reports** in case the server still completes.
- [ ] **Optional async job:** deferred — sync path + client/server timeouts + Phase 2 messaging is enough unless traffic proves otherwise.

## Phase 3 — Product depth

- [x] **Regenerate** (same day) with confirmation on report detail; **soft rate limit** via migration **`013_report_generation_events`** + env **`REPORT_GENERATE_MAX_PER_UTC_DAY`** (default **15**/UTC day).
- [x] **History UX:** month filter (UTC `YYYY-MM`), search over date + summary, richer empty state.
- [x] **Env-configurable model:** **`OPENAI_REPORT_MODEL`** (Express + Worker + Cloudflare sync); defaults to **`gpt-4o-mini`** for both LLM steps.
- [x] **Extension parity:** generate hint text aligned with web (timing expectations).

## References

- API: `packages/api/src/routes/reports.js`, `packages/api/src/services/openai.js`
- Worker: `packages/api-worker/src/routes/reports.ts`, `packages/api-worker/src/services/openai.ts`
- Web: `packages/web/src/app/dashboard/reports/*`, `generate-report-button.tsx`
- Backlog: `docs/IMPROVEMENTS_BACKLOG.md` (IMP-012)
