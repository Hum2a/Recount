import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/client.js", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

const signUpMock = vi.fn();
vi.mock("../../db/client-auth.js", () => ({
  supabaseAuth: {
    auth: {
      signUp: (...args) => signUpMock(...args),
    },
  },
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: "user-a" };
    req.profile = { license_active: true };
    next();
  },
  requireLicense: (_req, _res, next) => next(),
  userHasLicense: vi.fn(async () => true),
}));

vi.mock("../../lib/streaks.js", () => ({
  computeStreaksForUser: vi.fn(async () => ({ intention_streak: 0, tracking_streak: 0 })),
}));

vi.mock("../../services/openai.js", () => ({
  generateAccountabilityReport: vi.fn(async () => ({
    ai_summary: "ok",
    score: 7,
    goals_met: [],
    goals_missed: [],
  })),
}));

vi.mock("../../lib/login-events.js", () => ({
  recordLoginEvent: vi.fn(async () => {}),
}));

const { supabaseAdmin } = await import("../../db/client.js");
const { default: eventsRouter } = await import("../events.js");
const { default: intentionsRouter } = await import("../intentions.js");
const { default: reportsRouter } = await import("../reports.js");
const { default: profilesRouter } = await import("../profiles.js");

function buildApp(basePath, router) {
  const app = express();
  app.use(express.json());
  app.use(basePath, router);
  return app;
}

function makeDeleteSelectChain(result = { data: [{ id: "event-1" }], error: null }) {
  const chain = {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(async () => result),
  };
  return chain;
}

function makeSelectMaybeSingleChain(result = { data: null, error: null }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };
  return chain;
}

function makeUpsertSingleChain(result = { data: { id: "intent-1" }, error: null }) {
  const chain = {
    upsert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => result),
  };
  return chain;
}

function makeUpdateSingleChain(result = { data: { id: "user-a" }, error: null }) {
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => result),
  };
  return chain;
}

describe("Authorization guard regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("events delete always scopes by authenticated user id", async () => {
    const chain = makeDeleteSelectChain();
    supabaseAdmin.from.mockReturnValue(chain);
    const app = buildApp("/api/events", eventsRouter);

    const res = await request(app).delete("/api/events/me/activity/segments/11111111-1111-1111-1111-111111111111");

    expect(res.status).toBe(204);
    expect(chain.eq).toHaveBeenCalledWith("id", "11111111-1111-1111-1111-111111111111");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("intentions GET scopes lookup to authenticated user id", async () => {
    const chain = makeSelectMaybeSingleChain();
    supabaseAdmin.from.mockReturnValue(chain);
    const app = buildApp("/api/intentions", intentionsRouter);

    const res = await request(app).get("/api/intentions/2026-03-27");

    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(chain.eq).toHaveBeenCalledWith("date", "2026-03-27");
  });

  it("intentions POST rejects caller-supplied user_id field", async () => {
    const app = buildApp("/api/intentions", intentionsRouter);

    const res = await request(app).post("/api/intentions").send({
      date: "2026-03-27",
      goals: ["ship secure release"],
      user_id: "attacker-id",
    });

    expect(res.status).toBe(400);
  });

  it("reports GET scopes lookup to authenticated user id", async () => {
    const chain = makeSelectMaybeSingleChain();
    supabaseAdmin.from.mockReturnValue(chain);
    const app = buildApp("/api/reports", reportsRouter);

    const res = await request(app).get("/api/reports/2026-03-27");

    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(chain.eq).toHaveBeenCalledWith("date", "2026-03-27");
  });

  it("profiles PATCH ignores attacker user_id and updates only authenticated profile", async () => {
    const chain = makeUpdateSingleChain();
    supabaseAdmin.from.mockReturnValue(chain);
    const app = buildApp("/api/profiles", profilesRouter);

    const res = await request(app).patch("/api/profiles").send({
      user_id: "attacker-id",
      hourly_rate: 50,
    });

    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("id", "user-a");
    expect(chain.update).toHaveBeenCalled();
    const patch = chain.update.mock.calls[0][0];
    expect(patch).not.toHaveProperty("user_id");
    expect(patch.hourly_rate).toBe(50);
  });

  it("intentions POST writes authenticated user id even without request user_id", async () => {
    const chain = makeUpsertSingleChain();
    supabaseAdmin.from.mockReturnValue(chain);
    const app = buildApp("/api/intentions", intentionsRouter);

    const res = await request(app).post("/api/intentions").send({
      date: "2026-03-27",
      goals: ["goal-1"],
    });

    expect(res.status).toBe(200);
    const upsertPayload = chain.upsert.mock.calls[0][0];
    expect(upsertPayload.user_id).toBe("user-a");
  });
});

describe("Signup password policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects weak password missing uppercase character", async () => {
    const app = buildApp("/api/auth", (await import("../auth.js")).default);
    const res = await request(app).post("/api/auth/signup").send({
      email: "test@example.com",
      password: "lowercase123!",
    });
    expect(res.status).toBe(400);
    expect(String(res.body?.error ?? "")).toContain("uppercase");
  });

  it("rejects weak password shorter than 12 characters", async () => {
    const app = buildApp("/api/auth", (await import("../auth.js")).default);
    const res = await request(app).post("/api/auth/signup").send({
      email: "test@example.com",
      password: "Aa1!short",
    });
    expect(res.status).toBe(400);
    expect(String(res.body?.error ?? "")).toContain("at least 12");
  });

  it("accepts a strong password that meets policy", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "new-user", email: "test@example.com" },
        session: { access_token: "token", refresh_token: "refresh" },
      },
      error: null,
    });
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "profiles") {
        return { upsert };
      }
      return {};
    });

    const app = buildApp("/api/auth", (await import("../auth.js")).default);
    const res = await request(app).post("/api/auth/signup").send({
      email: "test@example.com",
      password: "VeryStrong#2026",
    });

    expect(res.status).toBe(200);
    expect(signUpMock).toHaveBeenCalled();
  });
});
