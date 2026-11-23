// Shared by the usage API (server) and the usage settings page (client): the periods, the parts, the units and their
// conversions.

/** Anthropic list prices, USD per million tokens, from the claude-api reference (cached 2026-10-06). */
export interface ModelPrice {
  input: number;
  output: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-mythos-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Cache reads cost a tenth of the input price (cache writes are billed at a premium and are not split out here). */
export const CACHE_READ_MULTIPLIER = 0.1;

/** Assumption, not a quoted rate: US dollars to euros. Update it when the exchange rate should change. */
export const EUR_PER_USD = 0.92;

/**
 * Assumption, not a measured figure: grams of CO2 equivalent per million tokens, for the model's compute.
 * Replace it with a published factor before relying on the CO2 unit.
 */
export const GRAMS_CO2E_PER_MILLION_TOKENS = 300;

export type UsageUnit = "tokens" | "usd" | "eur" | "co2";

export const USAGE_UNITS: { id: UsageUnit; label: string }[] = [
  { id: "tokens", label: "Token" },
  { id: "usd", label: "Dollar" },
  { id: "eur", label: "Euro" },
  { id: "co2", label: "CO2" },
];

export type UsageRange = "24h" | "this-month" | "this-year" | "all";

export const USAGE_RANGES: { id: UsageRange; label: string }[] = [
  { id: "24h", label: "24 hours" },
  { id: "this-month", label: "This month" },
  { id: "this-year", label: "This year" },
  { id: "all", label: "All time" },
];

export const DEFAULT_USAGE_RANGE: UsageRange = "24h";

export function isUsageRange(value: string | null): value is UsageRange {
  return USAGE_RANGES.some((range) => range.id === value);
}

/** One bar per hour for the last 24 hours, per day for this month, per month for this year, per year for all time. */
export function bucketGranularity(range: UsageRange): "hour" | "day" | "month" | "year" {
  switch (range) {
    case "24h":
      return "hour";
    case "this-month":
      return "day";
    case "this-year":
      return "month";
    case "all":
      return "year";
  }
}

/** The first instant of a range, or null for "all time". Months and years start at the UTC boundary. */
export function rangeStart(range: UsageRange, now: Date): Date | null {
  switch (range) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "this-month":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case "this-year":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    case "all":
      return null;
  }
}

/**
 * The parts of the usage, drawn as the segments of one bar. `input` and `output` come from the chat replies.
 * `title` is the model call that names a new conversation, `image` the images the agent generates, and `memory` what
 * Hindsight spends on retain, reflect and consolidation (read from its LLM request traces).
 */
export const USAGE_PARTS = [
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
  { id: "title", label: "Title" },
  { id: "image", label: "Image" },
  { id: "memory", label: "Memory" },
] as const;

export type UsagePart = (typeof USAGE_PARTS)[number]["id"];

/** The tokens and the dollar cost of one part. */
export interface PartTotals {
  tokens: number;
  costUsd: number;
}

/** Raw counts for a set of turns. Costs are in US dollars. */
export interface UsageTotals {
  parts: Record<UsagePart, PartTotals>;
  /** The part of the input read from the prompt cache. Already counted in the input part. */
  cachedInputTokens: number;
  turns: number;
}

export function emptyTotals(): UsageTotals {
  return {
    parts: {
      input: { tokens: 0, costUsd: 0 },
      output: { tokens: 0, costUsd: 0 },
      title: { tokens: 0, costUsd: 0 },
      memory: { tokens: 0, costUsd: 0 },
      image: { tokens: 0, costUsd: 0 },
    },
    cachedInputTokens: 0,
    turns: 0,
  };
}

/** One bar of the chart: an hour or a day, with the tokens and cost of each part in it. */
export interface UsageBucket {
  key: string;
  label: string;
  parts: Record<UsagePart, PartTotals>;
  /** The chat replies in the bar. */
  turns: number;
}

/** Adds `part` into `target`, part by part. */
export function addTotals(target: UsageTotals, part: UsageTotals): void {
  for (const { id } of USAGE_PARTS) {
    target.parts[id].tokens += part.parts[id].tokens;
    target.parts[id].costUsd += part.parts[id].costUsd;
  }
  target.cachedInputTokens += part.cachedInputTokens;
  target.turns += part.turns;
}

/**
 * The image model's prices, USD per million tokens (OpenAI's pricing page for gpt-image-2.6-flare, as reported by
 * third-party trackers in 2026): text input, image input, image output. Its text output is not billed.
 */
export const IMAGE_MODEL_PRICES: Record<string, { textInput: number; imageInput: number; imageOutput: number }> = {
  "gpt-image-2.6-flare": { textInput: 5, imageInput: 8, imageOutput: 30 },
};

/**
 * The input and output costs of one model's tokens. An image model prices its image input and output apart from its
 * text; a model without a listed price costs nothing here.
 */
export function inputOutputCost(
  model: string,
  tokens: { inputTokens: number; cachedInputTokens: number; outputTokens: number; imageInputTokens?: number | undefined },
): { input: number; output: number } {
  const imagePrice = IMAGE_MODEL_PRICES[model];
  if (imagePrice) {
    const imageInput = tokens.imageInputTokens ?? 0;
    const textInput = Math.max(tokens.inputTokens - imageInput, 0);
    return {
      input: (textInput * imagePrice.textInput + imageInput * imagePrice.imageInput) / 1_000_000,
      output: (tokens.outputTokens * imagePrice.imageOutput) / 1_000_000,
    };
  }
  const price = MODEL_PRICES[model];
  if (!price) return { input: 0, output: 0 };
  const uncachedInput = Math.max(tokens.inputTokens - tokens.cachedInputTokens, 0);
  return {
    input: (uncachedInput * price.input + tokens.cachedInputTokens * price.input * CACHE_READ_MULTIPLIER) / 1_000_000,
    output: (tokens.outputTokens * price.output) / 1_000_000,
  };
}

/** The value of one part in the chosen unit. */
export function valueOfPart(unit: UsageUnit, part: PartTotals): number {
  switch (unit) {
    case "tokens":
      return part.tokens;
    case "usd":
      return part.costUsd;
    case "eur":
      return part.costUsd * EUR_PER_USD;
    case "co2":
      return (part.tokens / 1_000_000) * GRAMS_CO2E_PER_MILLION_TOKENS;
  }
}

/** The value of a whole total in the chosen unit: the sum of its parts. */
export function valueIn(unit: UsageUnit, totals: UsageTotals): number {
  return USAGE_PARTS.reduce((sum, { id }) => sum + valueOfPart(unit, totals.parts[id]), 0);
}

/** Tokens of the input and output parts together. */
export function tokensIn(totals: UsageTotals): number {
  return totals.parts.input.tokens + totals.parts.output.tokens;
}
