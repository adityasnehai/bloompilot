import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, className, ...props }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="field-label">{label}</span>
      <input
        {...props}
        className={`field-control ${className ?? ""}`}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
