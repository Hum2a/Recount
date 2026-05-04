import { logger } from "../logger.js";

/**
 * Extract OpenAI request id for logs (SDK shapes vary by version).
 * @param {unknown} err
 */
function extractOpenAIRequestId(err) {
  if (!err || typeof err !== "object") return undefined;
  const o = /** @type {Record<string, unknown>} */ (err);
  if (typeof o.request_id === "string") return o.request_id;
  if (typeof o.requestID === "string") return o.requestID;
  const res = o.response;
  if (res && typeof res === "object" && "headers" in res) {
    const h = /** @type {{ headers?: { get?: (n: string) => string | null } }} */ (res).headers;
    if (h && typeof h.get === "function") {
      return h.get("x-request-id") ?? undefined;
    }
  }
  return undefined;
}

/**
 * Maps OpenAI / network failures from report generation to safe JSON for clients.
 * Always logs server-side; never leaks raw upstream messages.
 *
 * @param {unknown} err
 * @returns {{ httpStatus: number, body: { error: string, code: string } }}
 */
export function mapReportOpenAIError(err) {
  const requestId = extractOpenAIRequestId(err);
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof /** @type {{ status?: unknown }} */ (err).status === "number"
      ? /** @type {{ status: number }} */ (err).status
      : undefined;
  const name = typeof err === "object" && err !== null && "name" in err ? String(/** @type {{ name?: string }} */ (err).name ?? "") : "";
  const msg = typeof err === "object" && err !== null && "message" in err ? String(/** @type {{ message?: unknown }} */ (err).message ?? "") : String(err ?? "");

  logger.warn(
    { openaiRequestId: requestId, openaiHttpStatus: status, errName: name, errMsg: msg },
    "report generation AI failure"
  );

  if (status === 429 || /rate limit/i.test(msg) || /\b429\b/.test(msg)) {
    return {
      httpStatus: 429,
      body: {
        error: "Too many AI requests right now. Wait a minute and try again.",
        code: "report_rate_limit",
      },
    };
  }

  if (
    name === "AbortError" ||
    /timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up|abort/i.test(msg) ||
    status === 408
  ) {
    return {
      httpStatus: 503,
      body: {
        error: "Generation timed out. Try again — if it keeps failing, wait and retry later.",
        code: "report_timeout",
      },
    };
  }

  if (typeof status === "number" && status >= 500 && status < 600) {
    return {
      httpStatus: 503,
      body: {
        error: "The AI service is temporarily busy. Try again shortly.",
        code: "report_upstream",
      },
    };
  }

  if (status === 401 || status === 403) {
    return {
      httpStatus: 503,
      body: {
        error: "Report generation is unavailable. Please try again later.",
        code: "report_config",
      },
    };
  }

  if (status === 400) {
    return {
      httpStatus: 503,
      body: {
        error: "Could not complete your report for this day. Try again.",
        code: "report_bad_request",
      },
    };
  }

  return {
    httpStatus: 503,
    body: {
      error: "Could not generate your report. Try again in a moment.",
      code: "report_generation_failed",
    },
  };
}
