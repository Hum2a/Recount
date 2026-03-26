import { createHash } from "node:crypto";
import { z } from "zod";

export function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function zodErrorMessage(error: z.ZodError) {
  return error.issues.map((i) => i.message).join("; ");
}

export function getBearerToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function normalizeHostname(line: string) {
  return String(line)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

export function firstForwardedIp(forwardedFor: string | null) {
  if (!forwardedFor) return null;
  return forwardedFor.split(",")[0]?.trim() || null;
}

export function sha256Hex(input: string) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
