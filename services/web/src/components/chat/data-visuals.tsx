"use client";

import { z } from "zod";
import { ComparisonCard } from "@/components/assistant-ui/elements/comparison-card";
import { SpecSheet } from "@/components/assistant-ui/elements/spec-sheet";
import { TrendChart } from "./trend-chart";
import { jsonVisual, VisualSkeleton } from "./visual-block";

// The registry's comparison card and spec sheet, and our chart (TrendChart, the registry Chart's look), each written by the agent as a code block holding JSON. The
// JSON keys are snake_case, like image_group's.

/**
 * ```visual__comparison_card
 * { "traits": ["Battery", "Camera"], "options": [{ "name": "Pixel 10", "headline": "Best camera",
 *   "traits": ["30 h", "50 MP"] }], "recommended": "Pixel 10", "reason": "Best camera for the price." }
 * ```
 * A trait value of false (or null) shows as missing.
 */
const comparisonSchema = z
  .object({
    traits: z.array(z.string()).min(1),
    options: z
      .array(
        z.object({
          name: z.string().min(1),
          headline: z.string().default(""),
          traits: z.array(z.union([z.string(), z.literal(false), z.null()])),
        }),
      )
      .min(2)
      .max(4),
    recommended: z.string(),
    reason: z.string().default(""),
  })
  .refine((value) => value.options.some((option) => option.name === value.recommended), {
    message: "recommended must be the name of one of the options",
  });

const ComparisonCardBlock = jsonVisual({
  language: "visual__comparison_card",
  name: "Comparison",
  schema: comparisonSchema,
  skeleton: <VisualSkeleton className="h-56" label="Loading comparison" />,
  render: (value) => (
    <ComparisonCard
      className="my-3 max-w-full first:mt-0"
      traitLabels={value.traits}
      options={value.options.map((option) => ({
        id: option.name,
        name: option.name,
        headline: option.headline,
        traits: option.traits.map((trait) => trait ?? false),
      }))}
      recommendedId={value.recommended}
      reason={value.reason}
    />
  ),
});

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

export { ComparisonCardBlock, SpecSheetBlock, ChartBlock };
