import { and, eq, gte } from "drizzle-orm";
import {
  addTotals,
  emptyTotals,
  inputOutputCost,
  rangeStart,
  type UsageBucket,
  type UsageRange,
  type UsageTotals,
} from "@/lib/usage";
import { listLlmCalls } from "../clients/hindsight-client";
import { getDb } from "../db/client";
import { modelUsage, type UsageMetadata } from "../db/schema";
import { bucketKey, emptyBuckets } from "./buckets";

export interface UsageReport {
  range: UsageRange;
  totals: UsageTotals;
  /** The chart's bars, oldest first. */
  buckets: UsageBucket[];
  /** Chat replies whose tokens were estimated from their text, because they predate the recording of usage. */
  estimatedReplies: number;
  /** True when Hindsight could not be read: memory then counts as zero. */
  memoryUnavailable: boolean;
}

/** Token counts a model call reported. The provider may leave any of them out. */
interface ReportedUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

/**
 * Records the tokens of one model call in the user's usage. Best effort: a failed write is logged and never reaches the
 * caller, whose own work does not depend on it.
 *
 * With `messageId` (a chat reply), the reply's row is written once and then updated in place: the reply calls this at
 * every step, with its running total, so it is counted once however many steps it had.
 */
export async function recordModelUsage(entry: {
  userId: string;
  part: "chat" | "title" | "image";
  model: string;
  usage: ReportedUsage;
  messageId?: string;
  metadata?: UsageMetadata;
  estimated?: boolean;
}): Promise<void> {
  const inputTokens = entry.usage.inputTokens ?? 0;
  const outputTokens = entry.usage.outputTokens ?? 0;
  if (inputTokens === 0 && outputTokens === 0) return;
  const values = {
    userId: entry.userId,
    part: entry.part,
    model: entry.model,
    messageId: entry.messageId ?? null,
    inputTokens,
    outputTokens,
    cachedInputTokens: entry.usage.cachedInputTokens ?? 0,
    metadata: entry.metadata ?? null,
    estimated: entry.estimated ?? false,
  };
  try {
    const db = getDb();
    if (entry.messageId) {
      await db.insert(modelUsage).values(values).onConflictDoUpdate({
        target: modelUsage.messageId,
        set: {
          model: values.model,
          inputTokens,
          outputTokens,
          cachedInputTokens: values.cachedInputTokens,
          estimated: values.estimated,
        },
      });
    } else {
      await db.insert(modelUsage).values(values);
    }
  } catch (error) {
    console.warn("model usage not recorded", {
      part: entry.part,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The user's usage for a period, as bars and totals. The app's own calls come from `model_usage`: a chat reply
 * contributes its input and output, a title its input + output to the input (naming reads the user's message), an image
 * its input + output. Memory comes from Hindsight's traces of the calls it made for the user's bank (retain, reflect,
 * consolidation), input + output as well. Everything is priced here, as the model prices it. Rows survive the deletion of their conversation. Temporary chats count too.
 */
export async function usageForUser(
  user: { id: string; username: string },
  range: UsageRange,
  now: Date,
): Promise<UsageReport> {
  const userId = user.id;
  const start = rangeStart(range, now);
  let memoryUnavailable = false;
  // The bank is named after the username.
  const memoryCalls = await listLlmCalls(user.username, start).catch((error: unknown) => {
    console.warn("memory usage unavailable", { reason: error instanceof Error ? error.message : String(error) });
    memoryUnavailable = true;
    return [];
  });
  const rows = await getDb()
    .select({
      createdAt: modelUsage.createdAt,
      part: modelUsage.part,
      model: modelUsage.model,
      inputTokens: modelUsage.inputTokens,
      cachedInputTokens: modelUsage.cachedInputTokens,
      metadata: modelUsage.metadata,
      outputTokens: modelUsage.outputTokens,
      estimated: modelUsage.estimated,
    })
    .from(modelUsage)
    .where(and(eq(modelUsage.userId, userId), start ? gte(modelUsage.createdAt, start) : undefined));

  // "All time" starts the chart at the first call.
  const times = [...rows.map((row) => row.createdAt.getTime()), ...memoryCalls.map((call) => call.startedAt.getTime())];
  const earliest = times.length > 0 ? new Date(Math.min(...times)) : null;

  const totals = emptyTotals();
  const buckets = new Map(emptyBuckets(range, now, earliest).map((bucket) => [bucket.key, bucket]));
  let estimatedReplies = 0;

  for (const row of rows) {
    const cost = inputOutputCost(row.model, {
      inputTokens: row.inputTokens,
      cachedInputTokens: row.cachedInputTokens,
      outputTokens: row.outputTokens,
      imageInputTokens: row.metadata?.imageInputTokens,
    });
    const part = emptyTotals();
    part.cachedInputTokens = row.cachedInputTokens;
    if (row.part === "chat") {
      part.parts.input = { tokens: row.inputTokens, costUsd: cost.input };
      part.parts.output = { tokens: row.outputTokens, costUsd: cost.output };
      part.turns = 1;
      if (row.estimated) estimatedReplies += 1;
    } else {
      const target = row.part === "title" ? "input" : row.part;
      part.parts[target] = { tokens: row.inputTokens + row.outputTokens, costUsd: cost.input + cost.output };
    }

    addTotals(totals, part);
    const bucket = buckets.get(bucketKey(range, row.createdAt));
    if (bucket) addPart(bucket, part);
  }

  for (const call of memoryCalls) {
    // Hindsight names the model with its provider ("anthropic/claude-haiku-5-5"); the prices use the bare id.
    const model = call.model.split("/").at(-1) ?? call.model;
    const tokens = {
      inputTokens: call.inputTokens,
      cachedInputTokens: call.cachedTokens,
      outputTokens: call.outputTokens + call.thoughtsTokens,
    };
    const cost = inputOutputCost(model, tokens);
    const part = emptyTotals();
    part.parts.memory = { tokens: tokens.inputTokens + tokens.outputTokens, costUsd: cost.input + cost.output };

    addTotals(totals, part);
    const bucket = buckets.get(bucketKey(range, call.startedAt));
    if (bucket) addPart(bucket, part);
  }

  return {
    range,
    totals,
    buckets: [...buckets.values()],
    estimatedReplies,
    memoryUnavailable,
  };
}

/** Adds a row's parts into one bar of the chart. */
function addPart(bucket: UsageBucket, part: UsageTotals): void {
  for (const id of Object.keys(bucket.parts) as (keyof UsageBucket["parts"])[]) {
    bucket.parts[id].tokens += part.parts[id].tokens;
    bucket.parts[id].costUsd += part.parts[id].costUsd;
  }
  bucket.turns += part.turns;
}
