import { Hono } from "hono";
import { runWeeklyDigestJob } from "../lib/weekly-digest";
import { timingSafeStringEqual } from "../timing-safe";
import type { WorkerEnv } from "../env";

const jobs = new Hono<{ Bindings: WorkerEnv }>();

jobs.post("/weekly-digest", async (c) => {
  const secret = c.env.DIGEST_JOB_SECRET;
  if (!secret) return c.json({ error: "DIGEST_JOB_SECRET is not configured" }, 503);
  const got = c.req.header("x-recount-job-secret") ?? "";
  if (!timingSafeStringEqual(got, secret)) return c.json({ error: "Unauthorized" }, 401);

  const result = await runWeeklyDigestJob(c.env);
  return c.json({ data: result });
});

export default jobs;
