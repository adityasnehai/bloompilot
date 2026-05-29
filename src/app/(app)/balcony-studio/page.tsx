import { BalconyStudio } from "./balcony-studio";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Balcony Studio · BloomPilot" };

export default async function BalconyStudioPage() {
  const session = await requireSession();
  if (!session.onboarded) redirect("/onboarding");

  return <BalconyStudio />;
}
