export default function RemindersLoading() {
  return (
    <div className="grid gap-4" aria-label="Loading reminders" aria-busy="true">
      <section className="surface-panel animate-pulse px-4 py-5 sm:px-5">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="mt-3 h-8 w-40 rounded bg-white/10" />
        <div className="mt-3 h-4 max-w-md rounded bg-white/10" />
        <div className="mt-5 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {["one", "two", "three", "four"].map((item) => (
            <div key={item} className="h-20 rounded-2xl bg-white/5" />
          ))}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          {["channels", "latest", "policy"].map((item) => (
            <section key={item} className="surface-panel animate-pulse px-4 py-5 sm:px-5">
              <div className="h-3 w-28 rounded bg-white/10" />
              <div className="mt-3 h-6 w-56 rounded bg-white/10" />
              <div className="mt-4 h-20 rounded-2xl bg-white/5" />
            </section>
          ))}
        </div>
        <aside className="grid content-start gap-4">
          <div className="surface-panel h-64 animate-pulse bg-white/[.02]" />
          <div className="surface-panel h-48 animate-pulse bg-white/[.02]" />
        </aside>
      </div>
    </div>
  );
}
