// Shared by the usage API (server) and the usage settings page (client): the periods, the parts, the units and their
// conversions.

/** Assumption, not a quoted rate: US dollars to euros. Update it when the exchange rate should change. */
export const EUR_PER_USD = 0.92;

/**
 * Grams of CO2 equivalent per US dollar of model usage, an estimate. The footprint follows the cost: the price already
 * weighs what each token costs to compute (cached input at a tenth of input, output above both, an image's output far
 * above text), for every part, memory included. A model missing from server/usage/prices.ts costs nothing, so it emits
 * nothing.
 */
export const GRAMS_CO2E_PER_USD = 200;

/**
 * Everyday equivalents of an amount of CO2, from the smallest to the largest: each one covers the amounts below the next
 * one's floor, and the last one has no ceiling. `perKg` is how many of the thing one kilogram of CO2 equals (a kettle
 * boiled is about 80 g, a petrol car emits about 200 g per km, a litre of petrol about 2.3 kg, a kilogram of beef about
 * 27 kg, a short-haul flight about 150 kg per passenger, a tree absorbs about 25 kg a year). Rough, and meant as such.
 */
const CO2_EQUIVALENTS: { fromKg: number; icon: string; perKg: number; sentence: (x: string) => string }[] = [
  { fromKg: 0, icon: "☕", perKg: 12, sentence: (x) => `The equivalent of boiling a kettle ${x} times.` },
  { fromKg: 1, icon: "🚗", perKg: 5, sentence: (x) => `The equivalent of driving ${x} km in a petrol car.` },
  { fromKg: 10, icon: "⛽", perKg: 0.44, sentence: (x) => `The equivalent of burning ${x} litres of petrol.` },
  { fromKg: 100, icon: "🥩", perKg: 0.037, sentence: (x) => `The equivalent of producing ${x} kg of beef.` },
  { fromKg: 1_000, icon: "✈️", perKg: 0.0067, sentence: (x) => `The equivalent of ${x} short-haul flights per passenger.` },
  { fromKg: 10_000, icon: "🌳", perKg: 0.04, sentence: (x) => `The equivalent of one tree working for ${x} years to absorb it.` },
];

const equivalentCount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** An everyday equivalent of `grams` of CO2, shown under the total when the CO2 unit is selected. */
export function co2Equivalent(grams: number): { icon: string; text: string } {
  if (grams <= 0) return { icon: "🌱", text: "Nothing was emitted, boss" };
  const kg = grams / 1000;
  const equivalent = CO2_EQUIVALENTS.findLast((item) => kg >= item.fromKg) ?? CO2_EQUIVALENTS[0]!;
  return { icon: equivalent.icon, text: equivalent.sentence(equivalentCount.format(kg * equivalent.perKg)) };
}

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
 * The parts of the usage, drawn as the segments of one bar. `input` and `output` come from the chat replies (input with
 * its cache reads and writes); the model call that names a conversation counts as input (it reads the user's message).
 * `image` is the images the agent generates, and `memory` what Hindsight spends (retain, recall, reflect, consolidation,
 * summary refreshes, its decision model). Every figure comes from the ledger of model calls (server/usage/model-calls.ts).
 */
export const USAGE_PARTS = [
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
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
  turns: number;
}

export function emptyTotals(): UsageTotals {
  return {
    parts: {
      input: { tokens: 0, costUsd: 0 },
      output: { tokens: 0, costUsd: 0 },
      memory: { tokens: 0, costUsd: 0 },
      image: { tokens: 0, costUsd: 0 },
    },
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
  target.turns += part.turns;
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
      return part.costUsd * GRAMS_CO2E_PER_USD;
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
