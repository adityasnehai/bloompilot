"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthFormCard } from "@/components/auth/auth-form-card";

type AuthMode = "sign-in" | "sign-up";

type AuthOverlayTriggerProps = {
  mode: AuthMode;
  className: string;
  children: ReactNode;
};

export function AuthOverlayTrigger({
  mode,
  className,
  children,
}: AuthOverlayTriggerProps) {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<AuthMode>(mode);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setActiveMode(mode);
          setOpen(true);
        }}
      >
        {children}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close authentication dialog"
            className="absolute inset-0 bg-[rgba(11,24,18,0.44)] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-[480px]">
            <AuthFormCard
              mode={activeMode}
              onModeChange={setActiveMode}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

