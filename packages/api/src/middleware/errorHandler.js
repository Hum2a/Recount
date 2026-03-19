import { logger } from "../logger.js";

export function errorHandler(err, req, res, _next) {
  logger.error({ err, path: req.path }, "request error");
  const status = err.status ?? err.statusCode ?? 500;
  const message = status === 500 ? "Internal server error" : err.message ?? "Error";
  res.status(status).json({ error: message });
}
