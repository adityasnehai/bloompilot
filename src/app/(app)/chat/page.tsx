import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ChatView } from "@/components/chat/chat-view";

export const metadata = { title: "Chat · BloomPilot" };

export default async function ChatPage() {
  const session = await requireSession();
  if (!session.onboarded) redirect("/onboarding");

  return <ChatView />;
}
