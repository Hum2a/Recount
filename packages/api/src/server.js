import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./logger.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Recount API listening");
});

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "unhandledRejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  process.exit(1);
});
