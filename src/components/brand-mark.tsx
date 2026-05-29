import Link from "next/link";
import { appConfig } from "@/lib/app-config";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  if (compact) {
    return (
      <Link
        href="/dashboard"
        className="font-accent inline-flex items-baseline text-[1.15rem] font-semibold leading-none text-[var(--color-ink)]"
      >
        BloomPilot
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 text-left text-[var(--color-ink)]"
    >
      <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(18,58,42,0.16)] bg-[linear-gradient(160deg,#1a4633,#276146)] shadow-[0_10px_24px_rgba(15,45,33,0.18)]">
        <span className="absolute -left-1 -top-1 h-5 w-5 rounded-full bg-[rgba(230,244,236,0.28)]" />
        <span className="absolute right-1.5 top-1.5 h-4 w-2.5 rotate-[18deg] rounded-full bg-[rgba(186,226,200,0.95)]" />
        <span className="display-font text-lg font-semibold text-white">B</span>
      </span>
      <span className="flex flex-col">
        <span className="text-base font-semibold leading-none tracking-[0.16em] text-[var(--color-ink)] uppercase">
          {appConfig.name}
        </span>
        <span className="mt-1 text-xs tracking-[0.08em] text-[var(--color-muted)]">
          Garden operations for modern growers
        </span>
      </span>
    </Link>
  );
}
