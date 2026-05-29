import { GardenBuilder3D } from "./garden-builder-3d";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "3D Garden Builder · BloomPilot" };

export default async function Garden3DPage() {
  const session = await requireSession();
  if (!session.onboarded) redirect("/onboarding");

  return (
    <div className="fixed inset-0 z-50 bg-[#0a1a0f]">
      <GardenBuilder3D />
    </div>
  );
}
