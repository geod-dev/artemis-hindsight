import { z } from "zod";
import { getConfig } from "../config";

// Client for the Hindsight memory server. Each user has one bank, named after their username.
// Only recall and the bank lifecycle are used for now; retain is a later step.

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

function bankUrl(bankId: string, suffix = ""): URL {
  return new URL(
    `/v1/default/banks/${encodeURIComponent(bankId)}${suffix}`,
    getConfig().HINDSIGHT_URL,
  );
}

function headers(): Record<string, string> {
  const key = getConfig().HINDSIGHT_API_KEY;
  return {
    "content-type": "application/json",
    ...(key ? { authorization: `Bearer ${key}` } : {}),
  };
}

export async function recallMemories(bankId: string, query: string): Promise<RecalledFact[]> {
  const config = getConfig();
  const res = await fetch(bankUrl(bankId, "/memories/recall"), {
    method: "POST",
    headers: headers(),
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

/** Creates the user's memory bank. Hindsight answers the same way when the bank already exists, so this is idempotent. */
export async function createBank(bankId: string): Promise<void> {
  const res = await fetch(bankUrl(bankId), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`hindsight could not create bank ${bankId}: HTTP ${res.status}`);
}

/** Deletes the user's memory bank and everything in it. A bank that does not exist counts as deleted. */
export async function deleteBank(bankId: string): Promise<void> {
  const res = await fetch(bankUrl(bankId), {
    method: "DELETE",
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`hindsight could not delete bank ${bankId}: HTTP ${res.status}`);
}
