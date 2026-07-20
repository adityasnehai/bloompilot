import { PreferencesWizard } from "@/components/preferences/preferences-wizard";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function PreferencesPage() {
  const session = await requireSession();

  // Preferences is the first setup stage. Do not restart it when a user
  // returns after saving the stage or after completing onboarding.
  if (session.onboarded) {
    redirect("/dashboard");
  }

  if (session.location && session.gardenType && session.channels.length > 0) {
    redirect("/plant-setup");
  }

  return <PreferencesWizard session={session} />;
}
