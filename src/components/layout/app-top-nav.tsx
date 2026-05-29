"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/garden", label: "Plants" },
  { href: "/tasks", label: "Tasks" },
  { href: "/diagnosis", label: "Diagnosis" },
  { href: "/balcony-studio", label: "Garden Studio" },
  { href: "/settings", label: "Settings" },
];

export function AppTopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg border px-3 py-2 font-medium transition ${
              active
                ? "border-[var(--color-line)] bg-[var(--color-ink)] text-white shadow-sm"
                : "border-transparent text-[var(--color-muted)] hover:border-[var(--color-line)] hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
