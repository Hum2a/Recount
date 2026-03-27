import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/resend.js", () => ({
  sendLicenseEmail: vi.fn(async () => {}),
}));

vi.mock("../../logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const constructEvent = vi.fn();
vi.mock("../../services/stripe.js", () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args) => constructEvent(...args),
    },
  },
  createCheckoutSession: vi.fn(),
}));

vi.mock("../../db/client.js", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

const { supabaseAdmin } = await import("../../db/client.js");
const { sendLicenseEmail } = await import("../../services/resend.js");
const { stripeWebhookHandler } = await import("../payments.js");

const USER_ID = "11111111-1111-1111-1111-111111111111";

function sampleCheckoutCompletedEvent() {
  return {
    id: "evt_test_webhook_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        metadata: { userId: USER_ID },
        payment_intent: "pi_test_1",
        amount_total: 1499,
        currency: "gbp",
        customer_details: { email: "buyer@example.com" },
      },
    },
  };
}

function makeMaybeSingleChain(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };
  return chain;
}

function makeUpdateChain(profileErr = null) {
  const chain = {
    update: vi.fn((payload) => {
      chain._payload = payload;
      return chain;
    }),
    eq: vi.fn(async () => ({ error: profileErr })),
  };
  return chain;
}

describe("Stripe webhook handler (checkout.session.completed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    constructEvent.mockImplementation((_body, _sig, _secret) => sampleCheckoutCompletedEvent());
  });

  function mountWebhook() {
    const app = express();
    app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
    return app;
  }

  it("returns 200 immediately when event id was already processed (dedupe)", async () => {
    const seenChain = makeMaybeSingleChain({ data: { id: "evt_test_webhook_1" }, error: null });
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "stripe_webhook_events") return seenChain;
      throw new Error(`unexpected table ${table}`);
    });

    const app = mountWebhook();
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", "t=1,v1=fake")
      .set("Content-Type", "application/json")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(supabaseAdmin.from).toHaveBeenCalledWith("stripe_webhook_events");
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
    expect(sendLicenseEmail).not.toHaveBeenCalled();
  });

  it("activates license, upserts payment, sends email once, records event id", async () => {
    const insertChain = {
      insert: vi.fn(async () => ({ error: null })),
    };
    const priorChain = makeMaybeSingleChain({
      data: { license_active: false, license_key: null },
      error: null,
    });
    const updateChain = makeUpdateChain();

    supabaseAdmin.from
      .mockReturnValueOnce(makeMaybeSingleChain({ data: null, error: null }))
      .mockReturnValueOnce(priorChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce({ upsert: vi.fn(async () => ({ error: null })) })
      .mockReturnValueOnce(insertChain);

    const app = mountWebhook();
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", "t=1,v1=fake")
      .set("Content-Type", "application/json")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(insertChain.insert).toHaveBeenCalledWith({
      id: "evt_test_webhook_1",
      event_type: "checkout.session.completed",
    });
    expect(sendLicenseEmail).toHaveBeenCalledTimes(1);
    expect(sendLicenseEmail).toHaveBeenCalledWith("buyer@example.com", expect.any(String));
  });

  it("does not send license email when profile already had an active license", async () => {
    const priorChain = makeMaybeSingleChain({
      data: { license_active: true, license_key: "existing-key-uuid" },
      error: null,
    });
    const updateChain = makeUpdateChain();
    const insertChain = { insert: vi.fn(async () => ({ error: null })) };

    supabaseAdmin.from
      .mockReturnValueOnce(makeMaybeSingleChain({ data: null, error: null }))
      .mockReturnValueOnce(priorChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce({ upsert: vi.fn(async () => ({ error: null })) })
      .mockReturnValueOnce(insertChain);

    const app = mountWebhook();
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", "t=1,v1=fake")
      .set("Content-Type", "application/json")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(200);
    expect(sendLicenseEmail).not.toHaveBeenCalled();
    expect(insertChain.insert).toHaveBeenCalled();
  });

  it("rejects invalid Stripe signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });

    const app = mountWebhook();
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", "bad")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(400);
    expect(res.text).toContain("Webhook signature verification failed");
  });
});
