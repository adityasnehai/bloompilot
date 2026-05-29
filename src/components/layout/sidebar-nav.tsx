"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Plants, care, diagnosis",
  },
  {
    href: "/chat",
    label: "Chat",
    description: "Ask your garden anything",
  },
  {
    href: "/stats",
    label: "Stats",
    description: "Green thumb score & history",
  },
  {
    href: "/history",
    label: "History",
    description: "Past care plans",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Profile and setup",
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-2">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl border px-4 py-3 transition ${
              active
                ? "border-[rgba(16,52,39,0.12)] bg-[rgba(243,241,234,0.95)] text-[var(--color-ink)]"
                : "border-transparent bg-transparent text-[var(--color-ink)] hover:border-[rgba(16,52,39,0.08)] hover:bg-[rgba(243,241,234,0.7)]"
            }`}
          >
            <span className="block min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs text-[var(--color-muted)]">
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
