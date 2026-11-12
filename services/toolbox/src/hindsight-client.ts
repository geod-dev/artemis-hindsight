import { z } from "zod";

// Client for the Hindsight memory server, used by the memory tools (retain, recall, reflect).
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

// Hindsight sends based_on as null when the answer used no memory, so both the object and its list can be null.
const reflectResponse = z.object({
  text: z.string(),
  based_on: z
    .object({ memories: z.array(z.object({ text: z.string() })).nullish() })
    .nullish(),
});

export interface RecalledFact {
  text: string;
  type?: string;
}

export interface Reflection {
  answer: string;
  sources: string[];
}

export class HindsightClient {
  constructor(private readonly config: HindsightConfig) {}

  async recall(bank: string, query: string): Promise<RecalledFact[]> {
    const res = await this.send("POST", bank, "/memories/recall", {
      query,
      budget: this.config.toolRecallBudget,
      max_tokens: this.config.recallMaxTokens,
    }, 30_000);
    return recallResponse.parse(res).results;
  }

  /** Stores the text as a new document of the bank. Extraction runs in the background, so recall may lag a little. */
  async retain(bank: string, content: string, context?: string): Promise<void> {
    await this.send("POST", bank, "/memories", {
      items: [{ content, ...(context ? { context } : {}) }],
      async: true,
    }, 30_000);
  }

  /** Answers a question from the bank's memories, with the memories it relied on. */
  async reflect(bank: string, query: string): Promise<Reflection> {
    const res = await this.send("POST", bank, "/reflect", { query }, 120_000);
    const parsed = reflectResponse.parse(res);
    return {
      answer: parsed.text,
      sources: (parsed.based_on?.memories ?? []).map((memory) => memory.text),
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
