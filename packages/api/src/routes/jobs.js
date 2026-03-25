import { Router } from "express";
import { env } from "../config/env.js";
import { runWeeklyDigestJob } from "../lib/weekly-digest.js";
import { logger } from "../logger.js";

const router = Router();

/**
 * Cron / platform scheduler: POST with header X-Recount-Job-Secret matching DIGEST_JOB_SECRET.
 */
router.post("/weekly-digest", async (req, res, next) => {
  try {
    const secret = env.DIGEST_JOB_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "DIGEST_JOB_SECRET is not configured" });
    }
    const got = req.get("x-recount-job-secret");
    if (!got || got !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await runWeeklyDigestJob();
    logger.info(result, "weekly digest job completed");
    return res.json({ data: result });
  } catch (e) {
    next(e);
  }
});

export default router;
