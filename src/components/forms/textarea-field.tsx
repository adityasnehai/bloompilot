import type { TextareaHTMLAttributes } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export function TextareaField({
  label,
  hint,
  className,
  ...props
}: TextareaFieldProps) {
  return (
    <Label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
      <Textarea {...props} className={cn("min-h-32 py-3", className)} />
      {hint ? <span className="text-xs text-[var(--color-muted)]">{hint}</span> : null}
    </Label>
  );
}
