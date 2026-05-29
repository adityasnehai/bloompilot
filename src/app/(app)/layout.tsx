import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/session";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  return <AppShell session={session}>{children}</AppShell>;
}
