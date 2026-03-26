import { Resend } from "resend";
import type { WorkerEnv } from "../env";

export async function sendLicenseEmail(env: WorkerEnv, to: string, licenseKey: string) {
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to,
      subject: "Your Recount license",
      html: `<p>Thanks for purchasing Recount.</p><p>Your license key: <strong>${licenseKey}</strong></p>`,
    });
  } catch {
    // best effort email
  }
}

export async function sendWeeklyDigestEmail(
  env: WorkerEnv,
  to: string,
  range: { start: string; end: string },
  payload: { total_minutes: number; top_domains: { domain: string; seconds: number }[]; intention_days: number }
) {
  try {
    const resend = new Resend(env.RESEND_API_KEY);
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
    return !error;
  } catch {
    return false;
  }
}
