import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-normal transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-ink)] text-[var(--color-canvas)]",
        secondary: "bg-[var(--color-canvas-mint)] text-[var(--color-ink)]",
        outline: "border border-[var(--color-line)] bg-transparent text-[var(--color-muted)]",
        warning: "border border-[var(--color-line-strong)] bg-[var(--color-canvas-mint)] text-[var(--color-ink-muted)]",
        success: "border border-[#27a644]/35 bg-[#27a644]/12 text-[#7ad58e]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
