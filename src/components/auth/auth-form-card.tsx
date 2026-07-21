"use client";

import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "@/app/actions";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthMode = "sign-in" | "sign-up";

type AuthFormCardProps = {
  mode: AuthMode;
  error?: string;
  onModeChange?: (mode: AuthMode) => void;
  onClose?: () => void;
};

export function AuthFormCard({
  mode,
  error,
  onModeChange,
  onClose,
}: AuthFormCardProps) {
  const isSignUp = mode === "sign-up";
  const [showPassword, setShowPassword] = useState(false);

  const changeMode = (nextMode: AuthMode) => {
    if (onModeChange) onModeChange(nextMode);
    else window.location.href = nextMode === "sign-up" ? "/sign-up" : "/sign-in";
  };

  return (
    <Card className="w-full overflow-hidden border-white/10 bg-[rgba(12,12,13,0.94)] shadow-[0_24px_80px_rgba(0,0,0,0.46)] backdrop-blur-2xl [&_input]:text-white [&_input]:placeholder:text-white/40">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Tabs value={mode} onValueChange={(value) => changeMode(value as AuthMode)} className="min-w-0 flex-1">
            <TabsList className="h-11 w-full max-w-[248px] bg-white/5">
              <TabsTrigger
                value="sign-up"
                className="min-w-0 flex-1 px-3"
              >
                Sign up
              </TabsTrigger>
              <TabsTrigger
                value="sign-in"
                className="min-w-0 flex-1 px-3"
              >
                Sign in
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full border-white/10 bg-white/5"
            aria-label="Close authentication dialog"
            onClick={() => {
              if (onClose) onClose();
              else window.location.href = "/";
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          <p className="eyebrow">{isSignUp ? "Start here" : "Welcome back"}</p>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2.2rem]">
            {isSignUp ? "Create an account" : "Sign in"}
          </h1>
          <p className="max-w-md text-sm leading-6 text-white/65">
            {isSignUp
              ? "Create your account, then set up your garden."
              : "Return to your plants, tasks, and care workspace."}
          </p>
        </div>

        <Separator className="my-5 bg-white/10" />

        <form action={isSignUp ? signUpAction : signInAction} className="grid gap-4">
          {error ? (
            <div role="alert" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white/85">
              {error === "exists"
                ? "An account with this email already exists."
                : error === "rate_limited"
                ? "Too many attempts. Please wait a few minutes and try again."
                : error === "password_reset_required"
                  ? (
                      <>
                        <span>This older account needs a password reset before it can be used securely. </span>
                        <Link href="/forgot-password" className="font-medium underline">
                          Reset it by email.
                        </Link>
                      </>
                    )
                  : "Check your email and password. Passwords must be at least 8 characters."}
            </div>
          ) : null}

          {isSignUp ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="First name"
                name="firstName"
                type="text"
                placeholder="Ava"
                autoComplete="given-name"
                required
                className="text-white placeholder:text-white/40"
                labelClassName="text-white/90"
                hintClassName="text-white/55"
              />
              <TextField
                label="Last name"
                name="lastName"
                type="text"
                placeholder="Turner"
                autoComplete="family-name"
                required
                className="text-white placeholder:text-white/40"
                labelClassName="text-white/90"
                hintClassName="text-white/55"
              />
            </div>
          ) : null}

          <TextField
            label="Email"
            name="email"
            type="email"
            placeholder={isSignUp ? "ava@studio.com" : "you@studio.com"}
            autoComplete="email"
            required
            className="text-white placeholder:text-white/40"
            labelClassName="text-white/90"
            hintClassName="text-white/55"
          />

          <Label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white/90">Password</span>
            <div className="relative">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={isSignUp ? "Create a password" : "Enter your password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                className="pr-12 text-white placeholder:text-white/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-r-2xl text-muted-foreground transition hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className="text-xs text-white/55">{isSignUp ? "Use at least 8 characters." : "Your password is checked securely."}</span>
          </Label>

          <Button type="submit" size="lg" className="w-full bg-[var(--color-canopy)] text-white hover:bg-[var(--color-primary-hover)]">
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

      </CardContent>
    </Card>
  );
}
