"use server";

import { redirect } from "next/navigation";
import { runReminderSweep } from "@/lib/reminders";
import { readSession } from "@/lib/session";

export async function runReminderSweepAction(formData: FormData) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const returnTo = formData.get("returnTo")?.toString() ?? "/reminders";
  await runReminderSweep("manual");
  redirect(returnTo);
}
