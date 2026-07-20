import type { SelectHTMLAttributes } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  options: { label: string; value: string }[];
};

export function SelectField({
  label,
  hint,
  options,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <Label className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
      <select
        {...props}
        className={cn(
          "block h-11 min-w-0 w-full max-w-full truncate rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--color-ink)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="text-xs text-[var(--color-muted)]">{hint}</span> : null}
    </Label>
  );
}
