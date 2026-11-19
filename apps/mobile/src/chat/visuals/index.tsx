import type { ReactNode } from "react";
import type { z } from "zod";
import { ChartVisual } from "./chart-visual";
import { SpecSheetVisual } from "./data-cards";
import { ImageGroupVisual } from "./image-group-visual";
import { MermaidVisual } from "./mermaid-visual";
import { ProductGroupVisual } from "./product-group-visual";
import { ASPECT_RATIOS, chartSchema, imageGroupSchema, productGroupSchema, MAX_IMAGE_QUERIES, specSheetSchema, type AspectRatio } from "./schemas";
import { VisualError, VisualSkeleton } from "./shared";

/** Every visual the agent can put in a reply, by code block language (same set as the web app). */
export const VISUAL_LANGUAGES = new Set([
  "visual__image_group",
  "visual__product_group",
  "visual__spec_sheet",
  "visual__chart",
  "visual__diagram",
  "mermaid",
]);

/** Parses a JSON visual's block against its schema. The error says what to fix, so the agent's next try can use it. */
function parseJson<Schema extends z.ZodType>(code: string, schema: Schema): { ok: true; value: z.output<Schema> } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(code);
  } catch {
    return { ok: false, reason: "its JSON does not parse" };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues.map((issue) => issue.message).join("; ") };
  return { ok: true, value: parsed.data as z.output<Schema> };
}

function jsonVisual<Schema extends z.ZodType>(
  code: string,
  closed: boolean,
  schema: Schema,
  name: string,
  skeletonHeight: number,
  render: (value: z.output<Schema>) => ReactNode,
): ReactNode {
  if (!closed) return <VisualSkeleton label={`Loading ${name}`} height={skeletonHeight} />;
  const result = parseJson(code, schema);
  if (!result.ok) return <VisualError title={`${name} illisible`} message={result.reason} />;
  return render(result.value);
}

/** Parses an image group: one or more queries, each with a count, and an aspect ratio (snake_case or camelCase). */
function imageGroupOf(code: string): { ok: true; queries: string[]; perQuery: number; aspectRatio: AspectRatio } | { ok: false; reason: string } {
  const result = parseJson(code, imageGroupSchema);
  if (!result.ok) return { ok: false, reason: `it needs a query, a num_per_query and an aspect_ratio among ${ASPECT_RATIOS.join(", ")}` };
  const { query, num_per_query, aspect_ratio, aspectRatio } = result.value;
  const queries = [...new Set((Array.isArray(query) ? query : [query]).map((q) => q.trim()))].filter((q) => q !== "");
  if (queries.length === 0) return { ok: false, reason: "it has no query" };
  if (queries.length > MAX_IMAGE_QUERIES) return { ok: false, reason: `it has more than ${MAX_IMAGE_QUERIES} queries` };
  return { ok: true, queries, perQuery: num_per_query, aspectRatio: aspect_ratio ?? aspectRatio ?? "1:1" };
}

/** The visual for one code block of the agent's reply. An open block shows a skeleton until its closing fence arrives. */
export function renderVisual(language: string, code: string, closed: boolean): ReactNode {
  switch (language) {
    case "visual__image_group": {
      if (!closed) return <VisualSkeleton label="Loading images" height={166} />;
      const group = imageGroupOf(code);
      if (!group.ok) return <VisualError title="Image group unreadable" message={group.reason} />;
      return <ImageGroupVisual spec={{ queries: group.queries, perQuery: group.perQuery, aspectRatio: group.aspectRatio }} />;
    }
    case "visual__product_group":
      return jsonVisual(code, closed, productGroupSchema, "Products", 190, (value) => <ProductGroupVisual value={value} />);
    case "visual__spec_sheet":
      return jsonVisual(code, closed, specSheetSchema, "Spec sheet", 180, (value) => <SpecSheetVisual value={value} />);
    case "visual__chart":
      return jsonVisual(code, closed, chartSchema, "Chart", 180, (value) => <ChartVisual value={value} />);
    case "visual__diagram":
    case "mermaid":
      return <MermaidVisual code={code} closed={closed} />;
    default:
      return null;
  }
}
