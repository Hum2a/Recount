/**
 * Maps OpenAI / network failures from report generation to safe JSON for clients.
 * Worker duplicate of packages/api/src/lib/report-openai-errors.js (no shared import path).
 */
function extractOpenAIRequestId(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as Record<string, unknown>;
  if (typeof o.request_id === "string") return o.request_id;
  if (typeof o.requestID === "string") return o.requestID;
  const res = o.response as { headers?: { get?: (n: string) => string | null } } | undefined;
  if (res?.headers?.get) return res.headers.get("x-request-id") ?? undefined;
  return undefined;
}

export function mapReportOpenAIError(err: unknown): {
  httpStatus: number;
  body: { error: string; code: string };
} {
  const requestId = extractOpenAIRequestId(err);
  const status = typeof err === "object" && err !== null && "status" in err ? Number((err as { status?: number }).status) : undefined;
  const name =
    typeof err === "object" && err !== null && "name" in err ? String((err as { name?: string }).name ?? "") : "";
  const msg =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : String(err ?? "");

  console.warn("[reports/generate] AI failure", {
    openaiRequestId: requestId,
    openaiHttpStatus: status,
    errName: name,
    errMsg: msg,
  });

  if (status === 429 || /rate limit/i.test(msg) || /\b429\b/.test(msg)) {
    return {
      httpStatus: 429,
      body: {
        error: "Too many AI requests right now. Wait a minute and try again.",
        code: "report_rate_limit",
      },
    };
  }

  if (name === "AbortError" || /timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up|abort/i.test(msg) || status === 408) {
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
