"use client";

import Image from "next/image";
import { useState } from "react";

type GardenTypeOption = {
  label: string;
  value: string;
  description: string;
  imagePath: string;
  info: string;
};

type GardenTypeSelectorProps = {
  name: string;
  defaultValue?: string;
  options: GardenTypeOption[];
};

export function GardenTypeSelector({
  name,
  defaultValue,
  options,
}: GardenTypeSelectorProps) {
  const fallbackValue = defaultValue || options[0]?.value || "";
  const [selectedValue, setSelectedValue] = useState(fallbackValue);

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={selectedValue} />
      <div className="flex items-center gap-2">
        <span className="field-label">Garden type</span>
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(16,52,39,0.12)] text-[11px] font-semibold text-[var(--color-muted)]"
          title="Pick the setup that is closest to where most of your plants live."
        >
          i
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === selectedValue;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedValue(option.value)}
              className={`choice-card overflow-hidden p-0 text-left ${
                selected
                  ? "border-[var(--color-moss)] ring-2 ring-[rgba(76,121,97,0.14)]"
                  : ""
              }`}
            >
              <div className="relative h-32 w-full overflow-hidden border-b border-[rgba(16,52,39,0.08)] bg-[rgba(243,241,234,0.72)]">
                <Image
                  src={option.imagePath}
                  alt={option.label}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <span
                  className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[11px] font-semibold text-[var(--color-muted)] shadow-sm"
                  title={option.info}
                >
                  i
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {option.label}
                  </p>
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 rounded-full border ${
                      selected
                        ? "border-[var(--color-canopy)] bg-[var(--color-canopy)]"
                        : "border-[rgba(16,52,39,0.18)] bg-white"
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
