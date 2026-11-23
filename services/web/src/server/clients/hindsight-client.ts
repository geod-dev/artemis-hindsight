import { z } from "zod";
import { getConfig } from "../config";

// Client for the Hindsight memory server. Each user has one bank, named after their username.
// Recall for each user message, retain for the conversation flushes, and the bank lifecycle. How a bank is set up
// (missions, disposition, mental models) is in memory/bank-template.ts.

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

/** `now` anchors relative dates in the query ("last week") and recency scoring to the moment of the message. */
export async function recallMemories(bankId: string, query: string, now = new Date()): Promise<RecalledFact[]> {
  const config = getConfig();
  const res = await fetch(bankUrl(bankId, "/memories/recall"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      query,
      budget: config.MEMORY_RECALL_BUDGET,
      max_tokens: config.MEMORY_RECALL_MAX_TOKENS,
      query_timestamp: now.toISOString(),
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`hindsight recall failed with HTTP ${res.status}`);
  }
  const data = recallResponseSchema.parse(await res.json());
  return data.results;
}

/**
 * Applies a bank template manifest (config overrides, mental models, directives), creating the bank when it does not
 * exist. Idempotent: an unchanged mental model is not regenerated. See memory/bank-template.ts.
 */
export async function importBankTemplate(bankId: string, manifest: unknown): Promise<void> {
  const res = await fetch(bankUrl(bankId, "/import"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(manifest),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`hindsight could not set up bank ${bankId}: HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
}

/** One turn of a transcript, in Hindsight's conversation format. */
export interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Retains a transcript in the bank, in the document named by `documentId` (one per conversation).
 *
 *  - `append`: the turns are added to the document, so each call only sends what is new; Hindsight merges the JSON
 *    arrays of successive appends.
 *  - `replace`: the turns become the whole document. Hindsight re-extracts only the chunks that changed, deletes the
 *    facts of the chunks that are gone and the observations built from them, and consolidates again; mental models drop
 *    what only those facts supported at their next refresh. Used when the user left the branch of the conversation
 *    that memory holds, so the abandoned branch leaves memory.
 *
 * Async with a caller-chosen operation id: a retry of the same batch returns the original operation instead of
 * extracting the memories twice.
 *
 * `context` describes the source (who talks, which conversation), `timestamp` is when the conversation started, and
 * `strategy` names the retain strategy whose mission steers extraction.
 */
export async function retainTranscript(
  bankId: string,
  input: {
    documentId: string;
    turns: TranscriptTurn[];
    context: string;
    timestamp: Date;
    strategy: string;
    operationId: string;
    mode: "append" | "replace";
  },
): Promise<void> {
  const res = await fetch(bankUrl(bankId, "/memories"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      items: [
        {
          content: JSON.stringify(input.turns),
          document_id: input.documentId,
          update_mode: input.mode,
          context: input.context,
          timestamp: input.timestamp.toISOString(),
          strategy: input.strategy,
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

/**
 * Forgets one memory. Hindsight has no hard delete for a single memory, so it is invalidated: it stays in the bank for
 * audit but leaves recall, the graph, the list and consolidation, and a later append to its conversation does not
 * bring it back. Only facts (world, experience) can be invalidated; observations are derived from them.
 * Returns false when the bank has no such memory.
 */
export async function forgetMemory(bankId: string, memoryId: string): Promise<boolean> {
  const res = await fetch(bankUrl(bankId, `/memories/${encodeURIComponent(memoryId)}`), {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ state: "invalidated", reason: "deleted by the user in the memory settings" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`hindsight could not forget memory ${memoryId}: HTTP ${res.status}`);
  return true;
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

/**
 * Reads one of the bank's endpoints and returns its JSON, or null for a 404. For the memory explorer
 * (server/memory/memory-explorer.ts), which validates the shape.
 */
export async function readBank(
  bankId: string,
  suffix: string,
  query: Record<string, string | number> = {},
): Promise<unknown> {
  const url = bankUrl(bankId, suffix);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`hindsight ${suffix} failed for ${bankId}: HTTP ${res.status}`);
  return res.json();
}

const llmRequestsSchema = z.object({
  total: z.number(),
  items: z.array(
    z.object({
      operation: z.string().nullish(),
      model: z.string().nullish(),
      started_at: z.string(),
      input_tokens: z.number().nullish(),
      output_tokens: z.number().nullish(),
      cached_tokens: z.number().nullish(),
      thoughts_tokens: z.number().nullish(),
    }),
  ),
});

/** One model call Hindsight made for a bank (retain, reflect, consolidation...), as its trace recorded it. */
export interface HindsightLlmCall {
  operation: string;
  /** As Hindsight names it, with its provider prefix ("anthropic/claude-haiku-5-5"). */
  model: string;
  startedAt: Date;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  /** Reasoning tokens. Not in outputTokens, but billed as output by Anthropic. */
  thoughtsTokens: number;
}

const LLM_REQUESTS_PAGE = 500;

/**
 * The language-model calls Hindsight made for the bank since `start` (all of them when null), from its LLM request
 * traces. Embedding and rerank calls are left out. Hindsight keeps traces for HINDSIGHT_API_LLM_TRACE_RETENTION_DAYS
 * (0: forever, see docker-compose.yml); older calls are gone.
 */
export async function listLlmCalls(bankId: string, start: Date | null): Promise<HindsightLlmCall[]> {
  const calls: HindsightLlmCall[] = [];
  for (let offset = 0; ; offset += LLM_REQUESTS_PAGE) {
    const url = bankUrl(bankId, "/llm-requests");
    url.searchParams.set("call_type", "llm");
    url.searchParams.set("limit", String(LLM_REQUESTS_PAGE));
    url.searchParams.set("offset", String(offset));
    if (start) url.searchParams.set("start_date", start.toISOString());
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(30_000) });
    // A user without a bank yet has made no memory calls.
    if (res.status === 404) return calls;
    if (!res.ok) throw new Error(`hindsight llm-requests failed for ${bankId}: HTTP ${res.status}`);
    const page = llmRequestsSchema.parse(await res.json());
    for (const item of page.items) {
      calls.push({
        operation: item.operation ?? "unknown",
        model: item.model ?? "unknown",
        startedAt: new Date(item.started_at),
        inputTokens: item.input_tokens ?? 0,
        outputTokens: item.output_tokens ?? 0,
        cachedTokens: item.cached_tokens ?? 0,
        thoughtsTokens: item.thoughts_tokens ?? 0,
      });
    }
    if (page.items.length < LLM_REQUESTS_PAGE || offset + LLM_REQUESTS_PAGE >= page.total) return calls;
  }
}

/** How many of the bank's facts consolidation has not turned into observations yet. */
export async function pendingConsolidation(bankId: string): Promise<number> {
  const res = await fetch(bankUrl(bankId, "/stats"), { headers: headers(), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`hindsight stats failed for ${bankId}: HTTP ${res.status}`);
  return z.object({ pending_consolidation: z.number() }).parse(await res.json()).pending_consolidation;
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
