"use client";

import { useState } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { floating, mono } from "@/components/assistant-ui/elements/surfaces";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

// The one bar chart of the app: the usage page and the assistant's bar charts both draw with it. Built on shadcn's chart
// (Recharts): the scale starts at zero and reaches the highest bar, so no bar is shrunk by a floor; the hovered bar's
// column lights up; the top segment of each bar is rounded. The popover is ours, not Recharts': it follows the pointer
// and opens towards the side with room, so it never runs past the chart's edges.

/** One part of each bar: its key in the rows, its label, and its fill (any CSS color). */
export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

/** One bar: its label on the axis and in the popover, and one number per series. */
export interface BarRow {
  name: string;
  [series: string]: number | string;
}

export interface StackedBarChartProps {
  data: BarRow[];
  /** Bottom to top. One series is a plain bar chart. */
  series: BarSeries[];
  /** Formats a value on the popover's lines and the total. */
  formatValue: (value: number) => string;
  className?: string;
}

/** The gap between the pointer and the popover, so it does not cover the bar under it. */
const POPOVER_GAP = 14;
/** The plot's margins and the axis height: the hovered column is drawn from them. */
const MARGIN = { top: 8, right: 4, bottom: 0, left: 4 };
const AXIS_HEIGHT = 24;

interface Pointer {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function StackedBarChart({ data, series, formatValue, className }: StackedBarChartProps) {
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const config = Object.fromEntries(series.map((part) => [part.key, { label: part.label, color: part.color }])) satisfies ChartConfig;
  const topKey = series.at(-1)?.key;
  const row = activeIndex === null ? undefined : data[activeIndex];

  return (
    <div
      className={cn("relative h-full w-full", className)}
      onMouseMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setPointer({ x: event.clientX - box.left, y: event.clientY - box.top, width: box.width, height: box.height });
      }}
      onMouseLeave={() => {
        setPointer(null);
        setActiveIndex(null);
      }}
    >
      {/* The hovered bar's column, behind the chart: one band of the plot, its full height. */}
      {activeIndex !== null && data.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-sm bg-muted"
          style={{
            left: `calc(${MARGIN.left}px + (100% - ${MARGIN.left + MARGIN.right}px) * ${activeIndex / data.length})`,
            width: `calc((100% - ${MARGIN.left + MARGIN.right}px) / ${data.length})`,
            top: MARGIN.top,
            bottom: AXIS_HEIGHT + MARGIN.bottom,
          }}
        />
      )}
      <ChartContainer config={config} className="relative aspect-auto h-full w-full">
        <BarChart
          data={data}
          margin={MARGIN}
          onMouseMove={(state) => {
            const index = state.activeTooltipIndex;
            setActiveIndex(index === undefined || index === null ? null : Number(index));
          }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            height={AXIS_HEIGHT}
            interval="preserveStartEnd"
            className={cn(mono, "fill-muted-foreground")}
          />
          {/* The domain starts at zero and stops at the highest bar: that bar sets the scale. */}
          <YAxis hide domain={[0, "dataMax"]} />
          {/* Only so the chart tracks the hovered bar: the column and the popover are drawn by this component. */}
          <ChartTooltip isAnimationActive={false} cursor={false} content={() => null} />
          {series.map((part) => (
            <Bar
              key={part.key}
              dataKey={part.key}
              stackId="bars"
              fill={part.color}
              radius={part.key === topKey ? [3, 3, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>

      {pointer && row && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: pointer.x,
            top: pointer.y,
            // Opens on the side with room: left of the pointer in the chart's right half, above it in the lower half.
            transform: `translate(${
              pointer.x > pointer.width / 2 ? `calc(-100% - ${POPOVER_GAP}px)` : `${POPOVER_GAP}px`
            }, ${pointer.y > pointer.height / 2 ? `calc(-100% - ${POPOVER_GAP}px)` : `${POPOVER_GAP}px`})`,
          }}
        >
          <Popover row={row} series={series} formatValue={formatValue} />
        </div>
      )}
    </div>
  );
}

/** What one bar holds: its label, its non-zero parts, and their total when there are several. */
function Popover({
  row,
  series,
  formatValue,
}: {
  row: BarRow;
  series: BarSeries[];
  formatValue: (value: number) => string;
}) {
  const total = series.reduce((sum, part) => sum + Number(row[part.key] ?? 0), 0);
  // A part that is zero in this bar is left out: only what the bar holds is shown.
  const shown = series.filter((part) => Number(row[part.key] ?? 0) > 0);
  return (
    <div className={cn(floating, "min-w-44 rounded-surface p-3 text-xs whitespace-nowrap shadow-md")}>
      <p className="font-medium text-foreground">{row.name}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {shown.map((part) => (
          <li key={part.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: part.color }} />
              {part.label}
            </span>
            <span className="tabular-nums text-foreground">{formatValue(Number(row[part.key] ?? 0))}</span>
          </li>
        ))}
      </ul>
      {shown.length > 1 && (
        <p className="mt-2 flex items-center justify-between gap-4 border-t border-border/60 pt-2 font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatValue(total)}</span>
        </p>
      )}
    </div>
  );
}
