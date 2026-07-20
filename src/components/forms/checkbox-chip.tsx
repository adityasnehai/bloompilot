import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CheckboxChipProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  description: string;
};

export function CheckboxChip({
  label,
  description,
  className,
  ...props
}: CheckboxChipProps) {
  return (
    <label className="choice-card group">
      <input
        {...props}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-[rgba(16,52,39,0.3)] text-[var(--color-canopy)] focus:ring-[var(--color-moss)]",
          className,
        )}
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-[var(--color-ink)]">
          {label}
        </span>
        <span className="block text-xs leading-5 text-[var(--color-muted)]">
          {description}
        </span>
      </span>
    </label>
  );
}
