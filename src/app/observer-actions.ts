"use server";

import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { upsertWorkspaceProfile } from "@/lib/workspace-store";
import { runAlertObserver } from "@/lib/alert-observer";

export async function runObserverAction(formData: FormData) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const returnTo = formData.get("returnTo")?.toString() ?? "/dashboard";
  const userId = await upsertWorkspaceProfile(session);

  if (userId) {
    await runAlertObserver(userId, session.email);
  }

  redirect(returnTo);
}
