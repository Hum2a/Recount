import pino from "pino";
import { env } from "./config/env.js";

function redactHeaders(headers) {
  if (!headers || typeof headers !== "object") return headers;
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "cookie" || lower === "set-cookie") {
      out[key] = "[Redacted]";
    }
  }
  return out;
}

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "err.config.headers.authorization",
      "err.config.headers.Authorization",
    ],
    censor: "[Redacted]",
  },
  serializers: {
    err: pino.stdSerializers.err,
    req(req) {
      if (!req || typeof req !== "object") return req;
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: redactHeaders(req.headers),
      };
    },
  },
});
