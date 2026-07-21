import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

const sentryConfigured = Boolean(
  process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),
);

function emit(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const entry = { level, event, ts: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Every logger.error/warn call site across the app (agent guardrails, route
  // error handling, rate-limit failures, ...) automatically starts reporting to
  // Sentry once SENTRY_DSN is configured — no need to touch those call sites.
  if (sentryConfigured && (level === "error" || level === "warn")) {
    Sentry.captureMessage(event, { level: level === "error" ? "error" : "warning", extra: fields });
  }
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
