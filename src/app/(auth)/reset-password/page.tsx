import Link from "next/link";
import { completePasswordResetAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "@/components/forms/text-field";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  return (
    <div className="auth-onboarding flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="auth-onboarding-shell w-full max-w-[480px]">
        <CardContent className="p-5 sm:p-6">
          <Button asChild variant="ghost" size="sm" className="px-0 text-muted-foreground hover:bg-transparent hover:text-[var(--color-canopy)]">
            <Link href="/sign-in">← Back to sign in</Link>
          </Button>
          <p className="eyebrow mt-7">Account recovery</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight text-[var(--color-ink)]">Choose a new password.</h1>
          {error ? <p className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">This reset link is invalid or expired. Request a new one.</p> : null}
          <form action={completePasswordResetAction} className="mt-6 grid gap-4">
            <input type="hidden" name="token" value={token} />
            <TextField label="New password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
            <TextField label="Confirm password" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
            <Button type="submit" size="lg">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
