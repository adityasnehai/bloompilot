"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
            <p style={{ marginTop: "0.5rem", color: "#666" }}>
              Please refresh the page. If this keeps happening, try again shortly.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
