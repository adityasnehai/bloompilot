import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Low sample rate: this is error tracking, not full APM — keep free-tier quota
    // for actual errors, not routine trace volume.
    tracesSampleRate: 0.1,
  });
}
