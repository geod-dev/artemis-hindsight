import { z } from "zod";

// The agent writes each visual as a code block. These schemas are the same as the web app's
// (services/web/src/components/chat/data-visuals.tsx and image-group.tsx): the same replies render the same way.

export const MAX_IMAGES_PER_QUERY = 8;
export const MAX_IMAGE_QUERIES = 4;
export const ASPECT_RATIOS = ["1:1", "5:4", "16:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const comparisonSchema = z
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
export type ComparisonValue = z.infer<typeof comparisonSchema>;

export const specSheetSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  rows: z.array(z.object({ label: z.string().min(1), value: z.string(), emphasis: z.boolean().optional() })).min(1),
});
export type SpecSheetValue = z.infer<typeof specSheetSchema>;

export const chartSchema = z.object({
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
export type ChartValue = z.infer<typeof chartSchema>;

export const imageGroupSchema = z.object({
  query: z.union([z.string(), z.array(z.string())]),
  num_per_query: z.number().int().min(1).max(MAX_IMAGES_PER_QUERY).default(1),
  aspect_ratio: z.enum(ASPECT_RATIOS).optional(),
  /** Accepted too: the model may write it in camelCase. */
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
});

/** What /api/image-search answers for each result. */
export interface ImageResult {
  thumbnailUrl: string;
  imageUrl: string;
  pageUrl: string | null;
  title: string;
  source: string;
}
