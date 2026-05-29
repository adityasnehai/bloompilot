import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-[rgba(16,52,39,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.56))] px-5 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(76,121,97,0.1)] text-sm font-semibold text-[var(--color-moss)]">
        BP
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
        Nothing here yet
      </p>
      <h3 className="mt-3 text-2xl font-semibold text-[var(--color-ink)]">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[var(--color-muted)]">
        {body}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
