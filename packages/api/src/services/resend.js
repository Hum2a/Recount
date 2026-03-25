import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "../logger.js";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * @param {string} to
 * @param {string} licenseKey
 */
export async function sendLicenseEmail(to, licenseKey) {
  try {
    const { error } = await resend.emails.send({
      from: env.FROM_EMAIL,
      to,
      subject: "Your Recount license",
      html: `<p>Thanks for purchasing Recount.</p><p>Your license key: <strong>${licenseKey}</strong></p>`,
    });
    if (error) {
      logger.error({ err: error }, "resend license email");
    }
  } catch (e) {
    logger.error({ err: e }, "resend license email exception");
  }
}

/**
 * @param {string} to
 * @param {{ start: string, end: string }} range
 * @param {{ total_minutes: number, top_domains: { domain: string, seconds: number }[], intention_days: number }} payload
 * @returns {Promise<boolean>}
 */
export async function sendWeeklyDigestEmail(to, range, payload) {
  try {
    const topLines = payload.top_domains
      .map((t) => `<li>${t.domain} — ${Math.round(t.seconds / 60)} min</li>`)
      .join("");
    const html = `
      <p>Hi — here is your Recount weekly digest (UTC ${range.start} → ${range.end}).</p>
      <p><strong>Total tracked time:</strong> ${payload.total_minutes} minutes</p>
      <p><strong>Days with intentions logged:</strong> ${payload.intention_days}</p>
      <p><strong>Top sites:</strong></p>
      <ul>${topLines || "<li>No activity in this window.</li>"}</ul>
      <p><a href="${env.WEB_URL}/dashboard">Open dashboard</a></p>
    `;
    const { error } = await resend.emails.send({
      from: env.FROM_EMAIL,
      to,
      subject: `Recount weekly digest (${range.start} – ${range.end})`,
      html,
    });
    if (error) {
      logger.error({ err: error }, "resend weekly digest");
      return false;
    }
    return true;
  } catch (e) {
    logger.error({ err: e }, "resend weekly digest exception");
    return false;
  }
}
