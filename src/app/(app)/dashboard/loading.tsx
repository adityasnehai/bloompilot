// Route-level skeleton shown while the dashboard's care-plan agents run server-side.
export default function DashboardLoading() {
  return (
    <div className="grid gap-5">
      {/* Hero banner */}
      <div className="skeleton h-[112px] w-full rounded-2xl" style={{ opacity: 0.7 }} />

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.18)]">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-7 w-16" />
            <div className="skeleton mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)]/60 p-1">
        <div className="skeleton h-9 flex-1" />
        <div className="skeleton h-9 flex-1" style={{ opacity: 0.5 }} />
      </div>

      {/* Two-column content */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-4">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <div className="skeleton h-4 w-40" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <div className="skeleton h-4 w-44" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid content-start gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton mt-3 h-20 w-full" />
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-[var(--color-muted)]">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-canopy)] align-middle" />
        <span className="ml-2 align-middle">BloomPilot is preparing your care plan…</span>
      </p>
    </div>
  );
}
