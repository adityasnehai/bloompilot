"use server";

import { redirect } from "next/navigation";
import { runReminderSweep } from "@/lib/reminders";
import { readSession } from "@/lib/session";
import { sendTelegramTest } from "@/lib/telegram";

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

export async function sendTelegramTestAction(formData: FormData) {
  const session = await readSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  const returnTo = formData.get("returnTo")?.toString() ?? "/reminders";
  const recipient = session.telegramChatId?.trim();

  if (!recipient) {
    redirect(`${returnTo}?telegramTest=not_connected`);
  }

  const result = await sendTelegramTest(recipient);

  if (!result.ok) {
    redirect(
      `${returnTo}?telegramTest=failed&error=${encodeURIComponent(
        result.description ?? "Telegram send failed",
      )}`,
    );
  }

  redirect(`${returnTo}?telegramTest=sent`);
}
