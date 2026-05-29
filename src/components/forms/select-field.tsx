import type { SelectHTMLAttributes } from "react";

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
    <label className="flex flex-col gap-2">
      <span className="field-label">{label}</span>
      <select
        {...props}
        className={`field-control ${className ?? ""}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
