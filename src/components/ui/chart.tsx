"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn("flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-[#66776d] [&_.recharts-grid_line]:stroke-[#dce7d8] [&_.recharts-tooltip-cursor]:fill-[#eef4e8]", className)}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: colorConfig
          .map(([key, item]) => `[data-chart=${id}] { --color-${key}: ${item.color}; }`)
          .join("\n"),
      }}
    />
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

type ChartTooltipPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: React.ReactNode;
  color?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  className,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  className?: string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
      <div className={cn("grid min-w-[8rem] gap-1.5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-xl", className)}>
      {payload.map((item) => {
        const key = `${item.dataKey ?? item.name ?? "value"}`;
        const label = config[key]?.label ?? item.name;
        return (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-[var(--color-muted)]">{label}</span>
            </div>
            <span className="font-semibold text-[var(--color-ink)]">{item.value as React.ReactNode}</span>
          </div>
        );
      })}
    </div>
  );
}
