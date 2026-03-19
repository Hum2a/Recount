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
