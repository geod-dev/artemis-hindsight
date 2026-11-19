"use client";

import { z } from "zod";
import { SpecSheet } from "@/components/assistant-ui/elements/spec-sheet";
import { TrendChart } from "./trend-chart";
import { jsonVisual, VisualSkeleton } from "./visual-block";

// The registry's spec sheet and our chart (TrendChart, the registry Chart's look), each written by the agent as a code block holding JSON. The
// JSON keys are snake_case, like image_group's.

/**
 * ```visual__spec_sheet
 * { "title": "iPhone 17 Pro", "subtitle": "2026", "rows": [{ "label": "Display", "value": "6.3 in OLED" },
 *   { "label": "Price", "value": "1 229 €", "emphasis": true }] }
 * ```
 */
const specSheetSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  rows: z
    .array(z.object({ label: z.string().min(1), value: z.string(), emphasis: z.boolean().optional() }))
    .min(1),
});

const SpecSheetBlock = jsonVisual({
  language: "visual__spec_sheet",
  name: "Spec sheet",
  schema: specSheetSchema,
  skeleton: <VisualSkeleton className="h-48" label="Loading spec sheet" />,
  render: (value) => (
    <SpecSheet
      className="my-3 max-w-full first:mt-0"
      title={value.title}
      subtitle={value.subtitle}
      rows={value.rows}
      visibleCount={value.rows.length}
    />
  ),
});

/**
 * ```visual__chart
 * { "label": "Brent oil", "value": "$82", "delta": "+4.1%", "points": [74, 76, 79, 78, 82],
 *   "labels": ["Jul", "Aug", "Sep", "Oct", "Nov"], "unit": "$", "variant": "area", "up_is_good": false }
 * ```
 */
const chartSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  delta: z.string().optional(),
  points: z.array(z.number()).min(2),
  labels: z.array(z.string()).optional(),
  unit: z.string().optional(),
  // "line" is gone: replies written before it was removed show as an area chart.
  variant: z
    .enum(["area", "line", "bars"])
    .transform((variant) => (variant === "line" ? "area" : variant))
    .optional(),
  trend: z.enum(["up", "down", "flat"]).optional(),
  up_is_good: z.boolean().optional(),
});

const ChartBlock = jsonVisual({
  language: "visual__chart",
  name: "Chart",
  schema: chartSchema,
  skeleton: <VisualSkeleton className="h-44" label="Loading chart" />,
  render: (value) => (
    <TrendChart
      className="my-3 first:mt-0"
      label={value.label}
      value={value.value}
      delta={value.delta}
      points={value.points}
      labels={value.labels}
      unit={value.unit}
      variant={value.variant}
      trend={value.trend}
      upIsGood={value.up_is_good}
    />
  ),
});

export { SpecSheetBlock, ChartBlock };
