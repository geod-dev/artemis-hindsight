import { z } from "zod";

// Client for the Hindsight memory server, used by the memory tools (recall, reflect).
// Each user has one bank, named after their username. The web app has its own client for the automatic recall
// and for the flush of conversations.

export type RecallBudget = "low" | "mid" | "high";

export interface HindsightConfig {
  url: string;
  apiKey?: string;
  /** The search effort of the agent's recall tool. The web app's automatic recall has its own budget. */
  toolRecallBudget: RecallBudget;
  recallMaxTokens: number;
}

export function hindsightFromEnv(env: NodeJS.ProcessEnv): HindsightConfig {
  const budget = env.MEMORY_TOOL_RECALL_BUDGET ?? "mid";
  if (budget !== "low" && budget !== "mid" && budget !== "high") {
    throw new Error(`MEMORY_TOOL_RECALL_BUDGET must be low, mid or high, got ${budget}`);
  }
  return {
    url: env.HINDSIGHT_URL ?? "http://hindsight:8888",
    apiKey: env.HINDSIGHT_API_KEY || undefined,
    toolRecallBudget: budget,
    recallMaxTokens: Number(env.MEMORY_RECALL_MAX_TOKENS ?? 1024),
  };
}

const recallResponse = z.object({
  results: z.array(z.object({ text: z.string(), type: z.string().optional() })),
});

// based_on is only sent when the request sets include.facts. It is null when the answer used no memory, so the object
// and each of its lists can be null.
const reflectResponse = z.object({
  text: z.string(),
  based_on: z
    .object({
      memories: z.array(z.object({ text: z.string() })).nullish(),
      mental_models: z.array(z.object({ id: z.string() })).nullish(),
    })
    .nullish(),
});

export interface RecalledFact {
  text: string;
  type?: string;
}

export interface Reflection {
  answer: string;
  /** The memories the answer relied on. */
  sources: string[];
  /** The ids of the mental models (pre-computed summaries such as the user profile) the answer relied on. */
  mentalModels: string[];
}

export class HindsightClient {
  constructor(private readonly config: HindsightConfig) {}

  /** `now` anchors relative dates in the query ("last week") and recency scoring. */
  async recall(bank: string, query: string, now = new Date()): Promise<RecalledFact[]> {
    const res = await this.send("POST", bank, "/memories/recall", {
      query,
      budget: this.config.toolRecallBudget,
      max_tokens: this.config.recallMaxTokens,
      query_timestamp: now.toISOString(),
    }, 30_000);
    return recallResponse.parse(res).results;
  }

  /** Answers a question from the bank's memories, with the memories it relied on. */
  async reflect(bank: string, query: string): Promise<Reflection> {
    // include.facts makes Hindsight send the evidence; without it based_on is always missing.
    const res = await this.send("POST", bank, "/reflect", { query, include: { facts: {} } }, 120_000);
    const parsed = reflectResponse.parse(res);
    return {
      answer: parsed.text,
      sources: (parsed.based_on?.memories ?? []).map((memory) => memory.text),
      mentalModels: (parsed.based_on?.mental_models ?? []).map((model) => model.id),
    };
  }

  private async send(
    method: "POST",
    bank: string,
    suffix: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    const url = new URL(`/v1/default/banks/${encodeURIComponent(bank)}${suffix}`, this.config.url);
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`hindsight ${suffix} failed with HTTP ${res.status}`);
    return res.json();
  }
}
