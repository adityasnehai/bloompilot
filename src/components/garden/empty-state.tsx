import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed px-5 py-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-canvas-soft)] text-sm font-semibold text-[var(--color-canopy)]">
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
    </Card>
  );
}
