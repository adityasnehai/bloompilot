import type { TextareaHTMLAttributes } from "react";

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
    <label className="flex flex-col gap-2">
      <span className="field-label">{label}</span>
      <textarea
        {...props}
        className={`field-control min-h-32 py-3 ${className ?? ""}`}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
