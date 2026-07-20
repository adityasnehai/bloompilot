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
    href: "/garden-studio",
    label: "Placement Studio",
    description: "3D layout planner",
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
                ? "border-transparent bg-[var(--color-canvas-soft)] text-[var(--color-ink)]"
                : "border-transparent bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-canvas-sage)] hover:text-[var(--color-ink)]"
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
