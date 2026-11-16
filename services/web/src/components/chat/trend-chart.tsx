"use client";

import { curveCardinal } from "d3-shape";
import { Area, AreaChart, Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { useId, type FC } from "react";
import { mono, paper } from "@/components/assistant-ui/elements/surfaces";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

// The chart visual: one number and how it evolved. The same card as the registry's Chart (label, delta, value, a bare
// series with no axes or grid), drawn with shadcn's chart (Recharts) instead of a stretched SVG: points stay round at
// any width, and hovering a point shows its value (and its label, when the data has labels). Area charts show their
// start value in muted text just above the first point.

export type TrendVariant = "area" | "bars";

/** Slightly rounded: a cardinal curve halfway between straight segments (tension 1) and a loose spline (tension 0). */
const CURVE = curveCardinal.tension(0.5);

/** Up to this many points, every point has a small dot; above, only the last one. */
const MAX_DOTTED_POINTS = 16;
type Direction = "up" | "down" | "flat";

export interface TrendChartProps {
  label: string;
  value: string;
  delta?: string | undefined;
  points: readonly number[];
  /** One label per point (a date, a month, a year), shown on hover. */
  labels?: readonly string[] | undefined;
  /** The unit shown after each value on hover and on the start value ("$", "°C", "%"). */
  unit?: string | undefined;
  variant?: TrendVariant | undefined;
  trend?: Direction | undefined;
  upIsGood?: boolean | undefined;
  className?: string | undefined;
}

/** The direction the delta moved in, read from its sign when `trend` is not given (the registry Chart's rule). */
function directionOf(delta: string | undefined, trend: Direction | undefined): Direction | undefined {
  if (trend) return trend;
  if (delta === undefined) return undefined;
  if (/\d/.test(delta) && !/[1-9]/.test(delta)) return "flat";
  return /^\s*[-−–]/.test(delta) ? "down" : "up";
}

const formatValue = (value: number, unit: string | undefined) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;

export const TrendChart: FC<TrendChartProps> = ({
  label,
  value,
  delta,
  points,
  labels,
  unit,
  variant = "area",
  trend,
  upIsGood = true,
  className,
}) => {
  const gradientId = `trend-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const direction = directionOf(delta, trend);
  const good = direction === "up" || direction === "down" ? (direction === "up") === upIsGood : undefined;
  // The series takes the delta's color (green when the change is good news, red when bad, neutral otherwise) through
  // currentColor, so it follows the same light and dark shades as the delta text.
  const tone =
    good === undefined
      ? "text-foreground/70"
      : good
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";
  const config = { value: { label, color: "currentColor" } } satisfies ChartConfig;
  const data = points.map((point, index) => ({ name: labels?.[index] ?? "", value: point }));
  const lastIndex = data.length - 1;

  // The start value, in muted text just above the first point, inside the chart (area and line only: bars start at
  // the axis). The series itself starts at the card's left edge, like the registry Chart.
  const startLabel = (
    <LabelList
      dataKey="value"
      content={({ x, y, value: pointValue, index }) =>
        index === 0 && typeof x === "number" && typeof y === "number" ? (
          <text x={x} y={y - 9} textAnchor="start" className="fill-muted-foreground font-mono text-[11px]">
            {formatValue(Number(pointValue), unit)}
          </text>
        ) : null
      }
    />
  );
  // The hovered point: a solid dot in the series color, ringed with the card background.
  const activeDot = { r: 4, fill: "var(--color-value)", stroke: "var(--background)", strokeWidth: 2 };
  // The last point has a larger dot, so "now" stands out. With few points, every other point has a small dot too; with
  // many, they would crowd the line, so only the last one shows. Any point gets the active dot on hover.
  const everyPoint = data.length <= MAX_DOTTED_POINTS;
  const dot = ({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) => {
    if (cx === undefined || cy === undefined) return <g key={index} />;
    if (index === lastIndex) {
      return <circle key={index} cx={cx} cy={cy} r={4.5} fill="var(--color-value)" stroke="var(--background)" strokeWidth={2} />;
    }
    return everyPoint ? <circle key={index} cx={cx} cy={cy} r={2} fill="var(--color-value)" /> : <g key={index} />;
  };
  // Room above for the start value, and on the right for the last dot.
  const margin = { top: variant === "bars" ? 4 : 18, right: 8, bottom: 4, left: 0 };
  const axes = (
    <>
      <XAxis dataKey="name" hide />
      <YAxis hide domain={["auto", "auto"]} />
      <ChartTooltip
        isAnimationActive={false}
        cursor={
          variant === "bars"
            ? { fill: "var(--muted)", opacity: 0.6 }
            : { stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "3 3" }
        }
        content={({ active, payload }) => {
          const point = payload?.[0]?.payload as { name: string; value: number } | undefined;
          if (!active || !point) return null;
          // A small pill: the value, and the point's label when the data has labels.
          return (
            <div className={cn(paper, "flex items-baseline gap-2 rounded-md px-2 py-1 shadow-sm")}>
              <span className="text-foreground font-mono text-xs tabular-nums">{formatValue(point.value, unit)}</span>
              {point.name && <span className={cn(mono, "text-muted-foreground")}>{point.name}</span>}
            </div>
          );
        }}
      />
    </>
  );

  return (
    <div data-slot="chart" className={cn(paper, "flex w-full flex-col gap-3 rounded-2xl p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn(mono, "text-muted-foreground")}>{label}</span>
        {delta !== undefined && (
          <span
            data-trend={direction}
            className={cn(
              mono,
              "tabular-nums",
              good === undefined
                ? "text-muted-foreground"
                : good
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      <span className="text-2xl font-medium tracking-tight tabular-nums">{value}</span>

      <ChartContainer config={config} className={cn("aspect-auto h-28 w-full", tone)}>
        {variant === "bars" ? (
          <BarChart data={data} margin={margin}>
            {axes}
            <Bar dataKey="value" fill="var(--color-value)" radius={3} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={margin}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              dataKey="value"
              type={CURVE}
              stroke="var(--color-value)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={dot}
              activeDot={activeDot}
              isAnimationActive={false}
            >
              {startLabel}
            </Area>
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  );
};
