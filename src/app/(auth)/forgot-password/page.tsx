import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "@/components/forms/text-field";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <div className="auth-onboarding flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="auth-onboarding-shell w-full max-w-[480px]">
        <CardContent className="p-5 sm:p-6">
          <Button asChild variant="ghost" size="sm" className="px-0 text-muted-foreground hover:bg-transparent hover:text-[var(--color-canopy)]">
            <Link href="/sign-in">← Back to sign in</Link>
          </Button>
          <p className="eyebrow mt-7">Account recovery</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight text-[var(--color-ink)]">Reset your password.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">Enter your account email. If it exists, we will send a 30-minute reset link.</p>
          {sent === "1" ? <p className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">Check your email for the reset link. If it does not arrive, contact support.</p> : null}
          <form action={requestPasswordResetAction} className="mt-6 grid gap-4">
            <TextField label="Email" name="email" type="email" autoComplete="email" required />
            <Button type="submit" size="lg">Send reset link</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
