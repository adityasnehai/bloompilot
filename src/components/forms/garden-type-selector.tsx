"use client";

import Image from "next/image";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GardenTypeOption = {
  label: string;
  value: string;
  description: string;
  imagePath: string;
  info?: string;
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
  const validDefault = options.find((option) => option.value === defaultValue)?.value;
  const fallbackValue = validDefault || options[0]?.value || "";
  const [selectedValue, setSelectedValue] = useState(fallbackValue);

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={selectedValue} />
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === selectedValue;

          return (
            <Card
              key={option.value}
              className={cn(
                "group overflow-hidden rounded-2xl p-0 text-left transition",
                selected ? "border-[var(--color-line)]" : "hover:border-white/20",
              )}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedValue(option.value);
                }}
                className="relative flex min-h-[96px] w-full items-stretch text-left"
              >
                <div className="relative m-2 h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-muted/30 sm:h-[84px] sm:w-[88px]">
                  <Image
                    src={option.imagePath}
                    alt={option.label}
                    fill
                    unoptimized
                    className="object-cover object-center transition duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 px-3 py-3 pr-9">
                  <div>
                    <p className="break-words text-sm font-semibold text-[var(--color-ink)]">{option.label}</p>
                  </div>
                  <p className="text-xs leading-5 text-[var(--color-muted)]">{option.description}</p>
                </div>
                <span
                  aria-label={selected ? "Selected" : "Not selected"}
                  title={selected ? "Selected" : "Select this garden type"}
                  className={cn(
                    "absolute right-3 top-3 h-2.5 w-2.5 rounded-full border transition-colors",
                    selected
                      ? "border-[var(--color-canopy)] bg-[var(--color-canopy)]"
                      : "border-white/25 bg-transparent",
                  )}
                />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
