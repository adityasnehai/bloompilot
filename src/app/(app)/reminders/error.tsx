"use client";

export default function RemindersError({ reset }: { reset: () => void }) {
  return (
    <section className="surface-panel mx-auto max-w-2xl px-5 py-8 text-center sm:px-8">
      <p className="eyebrow">Reminders</p>
      <h1 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Reminders could not load</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-muted)]">
        Your reminder settings are safe. Try loading this page again.
      </p>
      <button type="button" onClick={() => reset()} className="button-primary mt-5">
        Try again
      </button>
    </section>
  );
}
