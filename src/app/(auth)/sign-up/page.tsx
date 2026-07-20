import { redirect } from "next/navigation";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { readSession } from "@/lib/session";

export default async function SignUpPage() {
  const session = await readSession();

  if (session) {
    redirect(session.onboarded ? "/dashboard" : "/preferences");
  }

  return (
    <div className="auth-onboarding flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[480px]">
        <AuthFormCard mode="sign-up" />
      </div>
    </div>
  );
}
