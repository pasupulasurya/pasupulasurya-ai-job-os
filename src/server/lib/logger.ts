import pino from "pino";

/**
 * Structured logger.
 *
 * Outputs JSON in production (parseable by log aggregators).
 * Outputs pretty-printed colorized logs in development.
 *
 * Usage:
 *   import { logger } from "@/server/lib/logger";
 *   logger.info({ userId, jobId }, "user.viewed_job");
 *   logger.error({ err }, "scrape.greenhouse.failed");
 *
 * Convention: event names use dot.notation describing what happened.
 *   - good: "scrape.greenhouse.success", "user.signup.completed"
 *   - bad:  "Logged in", "error"
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: {
    env: process.env.NODE_ENV,
    service: "ai-job-os",
  },
  // Redact common secret fields just in case they ever appear in log args
  redact: {
    paths: [
      "password",
      "token",
      "*.password",
      "*.token",
      "*.apiKey",
      "*.secret",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,service,env",
      },
    },
  }),
});

/**
 * Create a child logger bound to a specific context.
 * Use for request-scoped or job-scoped logging.
 *
 * Example:
 *   const scrapeLog = childLogger({ scope: "scraper", company: "stripe" });
 *   scrapeLog.info("started");
 *   scrapeLog.info({ jobs: 42 }, "completed");
 */
export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
