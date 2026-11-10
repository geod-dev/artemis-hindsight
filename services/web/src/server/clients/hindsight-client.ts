import { z } from "zod";
import { getConfig } from "../config";

// Client for the Hindsight memory server. Only recall is used for now; retain is a later step.

const recallResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      type: z.string().optional(),
    }),
  ),
});

export interface RecalledFact {
  id: string;
  text: string;
  type?: string;
}

export async function recallMemories(query: string): Promise<RecalledFact[]> {
  const config = getConfig();
  const url = new URL(
    `/v1/default/banks/${encodeURIComponent(config.HINDSIGHT_BANK_ID)}/memories/recall`,
    config.HINDSIGHT_URL,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.HINDSIGHT_API_KEY ? { authorization: `Bearer ${config.HINDSIGHT_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      query,
      budget: config.MEMORY_RECALL_BUDGET,
      max_tokens: config.MEMORY_RECALL_MAX_TOKENS,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`hindsight recall failed with HTTP ${res.status}`);
  }
  const data = recallResponseSchema.parse(await res.json());
  return data.results;
}
