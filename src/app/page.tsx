import { redirect } from "next/navigation";
import { AgencyLanding } from "@/components/home/agency-landing";
import { readSession } from "@/lib/session";

export default async function HomePage() {
  const session = await readSession();
  if (session) redirect(session.onboarded ? "/dashboard" : "/preferences");

  return <AgencyLanding />;
}
