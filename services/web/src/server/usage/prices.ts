import type { ModelCallTokenKind, ModelCallUsage } from "../db/schema";

// List prices, US dollars per million tokens. A call is priced once, when it is recorded (server/usage/model-calls.ts):
// a later change here never reprices the past. Sources, checked 2026-11-24:
//  - Anthropic: platform.claude.com/docs/en/about-claude/pricing and the prompt caching page. A cache write (5-minute
//    lifetime, the one the chat uses) is 1.25x the input price; a cache read is 0.1x on Haiku, 0.05x on Opus 5.5 and
//    Sonnet 5.5. Haiku 5.5 costs more when one request's prompt (input + cache reads + cache writes) is over 100,000
//    tokens.
//  - OpenAI: developers.openai.com/api/docs/pricing (GPT Image: text input, image input, image output).
//  - TypeSafe AI (Jev, Hindsight's decision model): input only, output tokens are free.

/** The tokens of one call, as the provider reported them. `input` is the uncached text input. */
export interface CallTokens {
  input: number;
  cacheRead?: number;
  cacheWrite?: number;
  output?: number;
  imageInput?: number;
  imageOutput?: number;
}

type Rates = Partial<Record<ModelCallTokenKind, number>>;

interface ModelPrice {
  rates: Rates;
  /** Rates that replace `rates` when one request's prompt is over `tokens` (Haiku 5.5 long context). */
  longPrompt?: { tokens: number; rates: Rates };
}

const anthropic = (input: number, output: number, cacheReadMultiplier = 0.1): Rates => ({
  input,
  cache_read: input * cacheReadMultiplier,
  cache_write: input * 1.25,
  output,
});

const PRICES: Record<string, ModelPrice> = {
  "claude-haiku-5-5": {
    rates: anthropic(0.1, 0.5),
    longPrompt: { tokens: 100_000, rates: anthropic(0.5, 2.5) },
  },
  "claude-sonnet-5-5": { rates: anthropic(2, 10, 0.05) },
  "claude-opus-5-5": { rates: anthropic(4, 20, 0.05) },
  "gpt-image-2.6-flare": { rates: { input: 5, image_input: 8, image_output: 30 } },
  jev: { rates: { input: 0.042 } },
};

/**
 * The key of a model in the price table. Hindsight prefixes its provider ("anthropic/claude-haiku-5-5") and names Jev
 * by its version ("jev-1.13.0"), which all share one price.
 */
function priceKey(model: string): string {
  const bare = model.split("/").at(-1) ?? model;
  return bare.startsWith("jev") ? "jev" : bare;
}

const unpriced = new Set<string>();

/**
 * Prices one call: the cost of each kind of token, and the total. A model missing from the table costs nothing and is
 * logged once, so a new model shows up in the logs instead of silently costing zero forever.
 */
export function priceCall(model: string, tokens: CallTokens): { usage: ModelCallUsage; costUsd: number } {
  const price = PRICES[priceKey(model)];
  if (!price && !unpriced.has(model)) {
    unpriced.add(model);
    console.warn("model call not priced: add the model to server/usage/prices.ts", { model });
  }
  const prompt = tokens.input + (tokens.cacheRead ?? 0) + (tokens.cacheWrite ?? 0);
  const rates = price?.longPrompt && prompt > price.longPrompt.tokens ? price.longPrompt.rates : (price?.rates ?? {});

  const counts: Record<ModelCallTokenKind, number> = {
    input: tokens.input,
    cache_read: tokens.cacheRead ?? 0,
    cache_write: tokens.cacheWrite ?? 0,
    output: tokens.output ?? 0,
    image_input: tokens.imageInput ?? 0,
    image_output: tokens.imageOutput ?? 0,
  };
  const usage: ModelCallUsage = {};
  let costUsd = 0;
  for (const [kind, count] of Object.entries(counts) as [ModelCallTokenKind, number][]) {
    if (count <= 0) continue;
    const cost = (count * (rates[kind] ?? 0)) / 1_000_000;
    usage[kind] = { tokens: count, cost };
    costUsd += cost;
  }
  return { usage, costUsd };
}
