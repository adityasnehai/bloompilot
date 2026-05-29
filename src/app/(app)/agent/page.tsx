import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { AgentProcessingScreen } from "@/components/agent/agent-processing-screen";

export default async function AgentPage() {
  const session = await requireSession();

  if (!session.onboarded) {
    redirect("/onboarding");
  }

  return <AgentProcessingScreen />;
}
