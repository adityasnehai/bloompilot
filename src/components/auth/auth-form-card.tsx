"use client";

import Link from "next/link";
import { signInAction, signUpAction } from "@/app/actions";
import { SelectField } from "@/components/forms/select-field";
import { TextField } from "@/components/forms/text-field";

type AuthMode = "sign-in" | "sign-up";

type AuthFormCardProps = {
  mode: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  onClose?: () => void;
};

export function AuthFormCard({
  mode,
  onModeChange,
  onClose,
}: AuthFormCardProps) {
  const isSignUp = mode === "sign-up";

  return (
    <section className="w-full rounded-[28px] border border-[rgba(255,255,255,0.45)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(244,248,241,0.97)_100%)] p-5 shadow-[0_22px_60px_rgba(15,45,33,0.16)] backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Link
            href="/"
            className="font-accent inline-flex items-center gap-2 text-sm font-medium text-[#62786b] transition hover:text-[#173528]"
          >
            <span className="text-base leading-none">←</span>
            Back to home
          </Link>
          <Link
            href="/"
            className="font-accent block text-[1.15rem] font-semibold leading-none text-[#173528] sm:text-[1.25rem]"
          >
            BloomPilot
          </Link>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dce7da] bg-white/82 text-lg text-[#173528] transition hover:bg-white"
            aria-label="Close"
          >
            ×
          </button>
        ) : (
          <span className="landing-pill shrink-0 border-0 bg-[#edf4e7] text-[#566e2e]">
            Secure access
          </span>
        )}
      </div>

      <div className="mt-7 space-y-3">
        <p className="eyebrow">{isSignUp ? "Create account" : "Welcome back"}</p>
        <h1 className="font-accent text-[1.9rem] font-semibold leading-[1.02] text-[#173528] sm:text-[2.15rem]">
          {isSignUp ? "Create your account." : "Sign in to continue."}
        </h1>
        <p className="landing-copy max-w-md text-[15px]">
          {isSignUp
            ? "Start with your account, then continue to garden setup."
            : "Return to your plants, tasks, and care workspace."}
        </p>
      </div>

      <form
        action={isSignUp ? signUpAction : signInAction}
        className="mt-6 grid gap-4"
      >
        {isSignUp ? (
          <>
            <TextField
              label="Full name"
              name="name"
              type="text"
              placeholder="Ava Turner"
              autoComplete="name"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Age"
                name="age"
                type="number"
                min="1"
                max="120"
                placeholder="28"
                hint="Optional"
              />
              <SelectField
                label="Gender"
                name="gender"
                defaultValue="Prefer not to say"
                options={[
                  { label: "Woman", value: "Woman" },
                  { label: "Man", value: "Man" },
                  { label: "Non-binary", value: "Non-binary" },
                  { label: "Prefer not to say", value: "Prefer not to say" },
                ]}
              />
            </div>
          </>
        ) : null}

        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder={isSignUp ? "ava@studio.com" : "you@studio.com"}
          autoComplete="email"
          required
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          placeholder={isSignUp ? "Create a password" : "Enter your password"}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          hint={isSignUp ? "You will continue to garden setup next." : "Demo sign-in stays local to this build."}
        />

        {!isSignUp ? (
          <div className="surface-card-muted p-4 text-sm text-[var(--color-muted)]">
            If setup is incomplete, BloomPilot will continue in the same focused flow.
          </div>
        ) : null}

        <button type="submit" className="font-accent inline-flex items-center justify-center rounded-full bg-[#173528] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(23,53,40,0.18)]">
          {isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="mt-5 text-sm text-[#62786b]">
        {isSignUp ? "Already have an account? " : "New to BloomPilot? "}
        {onModeChange ? (
          <button
            type="button"
            onClick={() => onModeChange(isSignUp ? "sign-in" : "sign-up")}
            className="font-medium text-[#173528] transition hover:text-[#566e2e]"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        ) : (
          <Link
            href={isSignUp ? "/sign-in" : "/sign-up"}
            className="font-medium text-[#173528] transition hover:text-[#566e2e]"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </Link>
        )}
      </div>
    </section>
  );
}
