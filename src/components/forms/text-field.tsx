import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  labelClassName?: string;
  hintClassName?: string;
};

export function TextField({ label, hint, labelClassName, hintClassName, className, ...props }: TextFieldProps) {
  return (
    <Label className="flex flex-col gap-2">
      <span className={cn("text-sm font-medium text-[var(--color-ink)]", labelClassName)}>{label}</span>
      <Input {...props} className={cn(className)} />
      {hint ? <span className={cn("text-xs text-[var(--color-muted)]", hintClassName)}>{hint}</span> : null}
    </Label>
  );
}
