import { ReactNode } from "react";
import Link from "next/link";
import { BellRing, Settings2 } from "lucide-react";
import { AppTopNav, MobileAppNav } from "@/components/layout/app-top-nav";
import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { DemoSession } from "@/lib/session";
import { PushSubscriptionSync } from "@/components/settings/push-subscription-sync";

type AppShellProps = {
  children: ReactNode;
  session: DemoSession;
};

export async function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <PushSubscriptionSync />
      <div className="flex min-h-screen w-full bg-transparent">
        <AppTopNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="app-top-bar hidden h-[72px] items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)]/90 px-6 lg:flex">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">Workspace</p>
            </div>
            <div className="app-header-actions flex h-full items-center gap-2.5 text-[var(--color-muted)]">
              <Link href="/reminders" aria-label="Reminders" className="rounded-lg p-2 hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)]"><BellRing className="h-4 w-4" /></Link>
              <Link href="/settings" aria-label="Settings" className="rounded-lg p-2 hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)]"><Settings2 className="h-4 w-4" /></Link>
              <span className="mx-1 h-6 w-px bg-[var(--color-line)]" />
              <Link href="/settings" className="flex shrink-0 items-center gap-2 text-left">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-canvas-mint)] text-[10px] font-bold text-[var(--color-canopy)]">{session.name.slice(0, 2).toUpperCase()}</span>
                <span className="hidden xl:block">
                  <span className="block text-xs font-bold text-[var(--color-ink)]">{session.name}</span>
                  <span className="block text-[10px] text-[var(--color-muted)]">Garden workspace</span>
                </span>
              </Link>
              <form action={signOutAction} className="flex shrink-0 items-center">
                <Button type="submit" variant="outline" size="sm" className="app-signout-button h-9 min-w-[76px] justify-center rounded-lg px-3 text-[11px]">Sign out</Button>
              </form>
            </div>
          </div>
          <MobileAppNav />
          <div className="app-mobile-signout flex justify-end border-b border-[var(--color-line)] bg-[var(--color-surface)]/90 px-4 py-2 lg:hidden">
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm" className="app-signout-button h-8 rounded-lg px-3 text-xs">Sign out</Button>
            </form>
          </div>
          <main className="min-w-0 flex-1 bg-background px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
