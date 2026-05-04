import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/client.js", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: "11111111-1111-1111-1111-111111111111" };
    req.profile = { license_active: true, app_role: "user" };
    next();
  },
  requireLicense: (_req, _res, next) => next(),
}));

const generateAccountabilityReport = vi.fn(async () => ({
  ai_summary: "Honest summary text.",
  score: 7,
  goals_met: ["Deep work"],
  goals_missed: ["Social"],
}));

vi.mock("../../services/openai.js", () => ({
  generateAccountabilityReport,
}));

vi.mock("../../logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { supabaseAdmin } = await import("../../db/client.js");
const { default: reportsRouter } = await import("../reports.js");

function makeIntentionsChain(goals) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: goals ? { goals } : null, error: null })),
  };
  return chain;
}

function makeTabEventsChain(rows) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(async () => ({ data: rows, error: null })),
  };
  return chain;
}

function makeReportsUpsertChain(saved) {
  const chain = {
    upsert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: saved, error: null })),
  };
  return chain;
}

/** Ledger table for soft daily rate limit (migration 013). */
function makeReportGenerationEventsTable(countForUtcDay) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          lt: vi.fn(async () => ({ count: countForUtcDay, error: null })),
        })),
      })),
    })),
    insert: vi.fn(async () => ({ error: null })),
  };
}

describe("POST /api/reports/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateAccountabilityReport.mockResolvedValue({
      ai_summary: "Honest summary text.",
      score: 7,
      goals_met: ["Deep work"],
      goals_missed: ["Social"],
    });
  });

  it("aggregates events, calls OpenAI, upserts report scoped to auth user", async () => {
    const intentionsChain = makeIntentionsChain(["Ship roadmap"]);
    const tabChain = makeTabEventsChain([
      { domain: "github.com", duration_sec: 3600, category: "work" },
    ]);
    const saved = {
      id: "rep-1",
      user_id: "11111111-1111-1111-1111-111111111111",
      date: "2026-03-15",
      ai_summary: "Honest summary text.",
      score: 7,
      goals_met: ["Deep work"],
      goals_missed: ["Social"],
      top_domains: [],
    };
    const reportsChain = makeReportsUpsertChain(saved);
    const eventsTable = makeReportGenerationEventsTable(0);

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "intentions") return intentionsChain;
      if (table === "tab_events") return tabChain;
      if (table === "report_generation_events") return eventsTable;
      if (table === "reports") return reportsChain;
      throw new Error(`unexpected table ${table}`);
    });

    const app = express();
    app.use(express.json());
    app.use("/api/reports", reportsRouter);

    const res = await request(app).post("/api/reports/generate").send({ date: "2026-03-15" });

    expect(res.status).toBe(200);
    expect(res.body.data?.date).toBe("2026-03-15");
    expect(res.body.data?.ai_summary).toBe("Honest summary text.");
    expect(generateAccountabilityReport).toHaveBeenCalledTimes(1);
    expect(reportsChain.upsert).toHaveBeenCalled();
    const upsertPayload = reportsChain.upsert.mock.calls[0][0];
    expect(upsertPayload.user_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(upsertPayload.date).toBe("2026-03-15");
    expect(eventsTable.insert).toHaveBeenCalled();
  });

  it("returns 400 for invalid date shape", async () => {
    supabaseAdmin.from.mockImplementation(() => makeIntentionsChain([]));
    const app = express();
    app.use(express.json());
    app.use("/api/reports", reportsRouter);

    const res = await request(app).post("/api/reports/generate").send({ date: "03-15-2026" });

    expect(res.status).toBe(400);
    expect(generateAccountabilityReport).not.toHaveBeenCalled();
  });

  it("returns 429 with structured body when OpenAI rate limits", async () => {
    generateAccountabilityReport.mockRejectedValueOnce(
      Object.assign(new Error("Too Many Requests"), { status: 429 })
    );
    const intentionsChain = makeIntentionsChain(["x"]);
    const tabChain = makeTabEventsChain([]);
    const eventsTable = makeReportGenerationEventsTable(0);
    const reportsChain = makeReportsUpsertChain({});
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "intentions") return intentionsChain;
      if (table === "tab_events") return tabChain;
      if (table === "report_generation_events") return eventsTable;
      if (table === "reports") return reportsChain;
      throw new Error(`unexpected table ${table}`);
    });

    const app = express();
    app.use(express.json());
    app.use("/api/reports", reportsRouter);

    const res = await request(app).post("/api/reports/generate").send({ date: "2026-03-15" });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("report_rate_limit");
    expect(typeof res.body.error).toBe("string");
    expect(reportsChain.upsert).not.toHaveBeenCalled();
  });

  it("returns 429 when daily report generation count is at the limit", async () => {
    const intentionsChain = makeIntentionsChain(["x"]);
    const tabChain = makeTabEventsChain([]);
    const eventsTable = makeReportGenerationEventsTable(15);
    const reportsChain = makeReportsUpsertChain({});
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "intentions") return intentionsChain;
      if (table === "tab_events") return tabChain;
      if (table === "report_generation_events") return eventsTable;
      if (table === "reports") return reportsChain;
      throw new Error(`unexpected table ${table}`);
    });

    const app = express();
    app.use(express.json());
    app.use("/api/reports", reportsRouter);

    const res = await request(app).post("/api/reports/generate").send({ date: "2026-03-15" });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("report_daily_limit");
    expect(generateAccountabilityReport).not.toHaveBeenCalled();
    expect(eventsTable.insert).not.toHaveBeenCalled();
  });
});
