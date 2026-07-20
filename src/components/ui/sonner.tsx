"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        style: {
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "var(--color-ink)",
          background: "rgba(15, 15, 17, 0.96)",
        },
      }}
    />
  );
}
