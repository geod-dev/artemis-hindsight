import { z } from "zod";
import { getConfig } from "../config";

// Client for the Hindsight memory server. Each user has one bank, named after their username.
// Recall for each user message, retain for the conversation flushes, and the bank lifecycle.

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

/**
 * Retains a transcript in the bank. The items go into the document named by `documentId` (one per conversation) and are
 * appended to it, so each call only adds what is new. Async with a caller-chosen operation id: a retry of the same batch
 * returns the original operation instead of extracting the memories twice.
 */
export async function retainTranscript(
  bankId: string,
  input: { documentId: string; content: string; operationId: string },
): Promise<void> {
  const res = await fetch(bankUrl(bankId, "/memories"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      items: [
        {
          content: input.content,
          document_id: input.documentId,
          update_mode: "append",
          context: "chat conversation",
        },
      ],
      async: true,
      operation_id: input.operationId,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`hindsight retain failed with HTTP ${res.status}`);
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

/** The id of every bank on the server. */
export async function listBankIds(): Promise<string[]> {
  const res = await fetch(new URL("/v1/default/banks", getConfig().HINDSIGHT_URL), {
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`hindsight could not list banks: HTTP ${res.status}`);
  const body = z.object({ banks: z.array(z.object({ bank_id: z.string() })) }).parse(await res.json());
  return body.banks.map((bank) => bank.bank_id);
}

/**
 * Starts consolidation of the bank's memories that are not consolidated yet, and returns the async operation id.
 * Hindsight answers at once; the work runs in the background and is visible in the bank's operations.
 */
export async function consolidateBank(bankId: string): Promise<string> {
  const res = await fetch(bankUrl(bankId, "/consolidate"), {
    method: "POST",
    headers: headers(),
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`hindsight consolidate failed for ${bankId}: HTTP ${res.status}`);
  const body = z.object({ operation_id: z.string() }).parse(await res.json());
  return body.operation_id;
}

export interface MemoryGraph {
  nodes: {
    id: string;
    label: string;
    text: string;
    date: string;
    context: string;
    factType: string | null;
    color: string | null;
  }[];
  edges: { id: string; source: string; target: string; weight: number; linkType: string; color: string | null }[];
}

const graphSchema = z.object({
  nodes: z.array(
    z.object({
      data: z.object({
        id: z.string(),
        label: z.string().nullish(),
        text: z.string().nullish(),
        date: z.string().nullish(),
        context: z.string().nullish(),
        color: z.unknown().optional(),
      }),
    }),
  ),
  edges: z.array(
    z.object({
      data: z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        weight: z.number().nullish(),
        linkType: z.string().nullish(),
        color: z.unknown().optional(),
      }),
    }),
  ),
});

/** Each memory's fact type (world, experience, observation). The graph does not carry it, so it comes from the list. */
async function factTypesOf(bankId: string, limit: number): Promise<Map<string, string>> {
  const url = bankUrl(bankId, "/memories/list");
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`hindsight memory list failed with HTTP ${res.status}`);
  const body = z.object({ items: z.array(z.object({ id: z.string(), fact_type: z.string().nullish() })) }).parse(await res.json());
  return new Map(body.items.flatMap((item) => (item.fact_type ? [[item.id, item.fact_type] as const] : [])));
}

/** The bank's memory graph: facts and entities as nodes, the links between them as edges. */
export async function getMemoryGraph(bankId: string, limit = 400): Promise<MemoryGraph> {
  const url = bankUrl(bankId, "/graph");
  url.searchParams.set("limit", String(limit));
  const [res, factTypes] = await Promise.all([
    fetch(url, { headers: headers(), signal: AbortSignal.timeout(30_000) }),
    factTypesOf(bankId, limit),
  ]);
  if (!res.ok) throw new Error(`hindsight graph failed with HTTP ${res.status}`);
  const body = graphSchema.parse(await res.json());
  const colorOf = (value: unknown) => (typeof value === "string" ? value : null);
  return {
    nodes: body.nodes.map(({ data }) => ({
      id: data.id,
      label: data.label ?? "",
      text: data.text ?? "",
      date: data.date ?? "",
      context: data.context ?? "",
      factType: factTypes.get(data.id) ?? null,
      color: colorOf(data.color),
    })),
    edges: body.edges.map(({ data }) => ({
      id: data.id,
      source: data.source,
      target: data.target,
      weight: data.weight ?? 1,
      linkType: data.linkType ?? "",
      color: colorOf(data.color),
    })),
  };
}
