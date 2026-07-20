"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BellRing,
  BookOpen,
  CheckSquare2,
  Leaf,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings2,
  Sprout,
  Stethoscope,
  TreePine,
} from "lucide-react";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/garden", label: "Plants", icon: Leaf },
      { href: "/tasks", label: "Tasks", icon: CheckSquare2 },
      { href: "/diagnosis", label: "Diagnosis", icon: Stethoscope },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/stats", label: "Garden stats", icon: Sprout },
      { href: "/history", label: "Care history", icon: BookOpen },
      { href: "/reminders", label: "Reminders", icon: BellRing },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/garden-studio", label: "Placement studio", icon: TreePine },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  mobile = false,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  pathname: string;
  mobile?: boolean;
  collapsed?: boolean;
}) {
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`group flex items-center gap-3 rounded-lg py-2 text-[12px] font-semibold transition-colors ${
        active
          ? "bg-[var(--color-canvas-soft)] text-[var(--color-ink)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-canvas-sage)] hover:text-[var(--color-ink)]"
      } ${collapsed ? "justify-center px-2" : "px-3"} ${mobile ? "min-w-max" : "w-full"}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]"}`} strokeWidth={1.8} />
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );
}

export function AppTopNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const isDashboard = pathname.startsWith("/dashboard");

  return (
    <>
      <aside className={`sticky top-0 hidden h-screen max-h-screen shrink-0 flex-col overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-surface)]/95 transition-[width] duration-200 ease-out lg:flex ${collapsed ? "w-[68px]" : "w-[230px]"}`}>
        <div className={`flex h-[72px] shrink-0 items-center border-b border-[var(--color-line)] ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          {!collapsed ? (
            <Link href="/dashboard" className="app-brand" aria-label="BloomPilot dashboard">
              BloomPilot
            </Link>
          ) : <span className="text-sm font-semibold tracking-[-0.04em] text-[var(--color-ink)]" aria-hidden>B</span>}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-canvas-mint)] hover:text-[var(--color-ink)]"
          >
            <CollapseIcon className="h-4 w-4" />
          </button>
        </div>

        <nav className={`flex-1 space-y-6 py-6 ${collapsed ? "px-2" : "px-3"}`} aria-label="Primary navigation">
          {navGroups.map((group, index) => (
            <div key={group.label} className={index > 0 && !collapsed ? "border-t border-[var(--color-line)] pt-5" : undefined}>
              {!collapsed ? <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]/75">{group.label}</p> : null}
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {isDashboard ? (
          <div className={`shrink-0 border-t border-[var(--color-line)] ${collapsed ? "p-2" : "px-3 py-4 mb-2"}`}>
            <button
              type="button"
              onClick={() => {
                fetch("/api/care-plan/generate", { method: "POST" })
                  .then((response) => {
                    if (!response.ok) throw new Error("Care plan refresh failed");
                    window.location.reload();
                  })
                  .catch(() => {
                    window.location.reload();
                  });
              }}
              className={`app-update-plan-button flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] !bg-[var(--color-canopy)] px-2.5 py-1.5 text-xs font-semibold !text-white shadow-sm transition hover:!bg-[var(--color-canopy-hover)] hover:!text-white ${
                collapsed ? "px-2" : ""
              }`}
              aria-label="Update care plan"
              title="Update care plan"
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>Update plan</span> : null}
            </button>
          </div>
        ) : null}
      </aside>

    </>
  );
}

export function MobileAppNav() {
  const pathname = usePathname();

  return (
    <div className="app-mobile-nav border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 px-4 py-3 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="app-brand" aria-label="BloomPilot dashboard">
          BloomPilot
        </Link>
        <Link href="/settings" aria-label="Settings" className="rounded-lg p-2 text-[var(--color-muted)]"><Settings2 className="h-4 w-4" /></Link>
      </div>
      <nav className="mt-3 flex gap-1 overflow-x-auto" aria-label="Primary navigation">
        {navGroups.flatMap((group) => group.items).map((item) => <NavLink key={item.href} {...item} pathname={pathname} mobile />)}
      </nav>
    </div>
  );
}
