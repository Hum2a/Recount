import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare for secrets (e.g. cron job header). */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
