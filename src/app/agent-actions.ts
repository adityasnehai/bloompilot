"use server";

import { redirect } from "next/navigation";
import { runAgentBrief } from "@/lib/agent-runtime";
import { readSession } from "@/lib/session";

export async function runAgentAction(formData: FormData) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const returnTo = formData.get("returnTo")?.toString() ?? "/agent";
  await runAgentBrief("manual");
  redirect(returnTo);
}
