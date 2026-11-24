import { and, asc, eq, gte } from "drizzle-orm";
import {
  emptyTotals,
  rangeStart,
  type UsageBucket,
  type UsagePart,
  type UsageRange,
  type UsageTotals,
} from "@/lib/usage";
import { getDb } from "../db/client";
import { modelCalls, type ModelCallContext, type ModelCallTokenKind, type ModelCallUsage } from "../db/schema";
import { bucketKey, emptyBuckets } from "./buckets";
import { syncMemoryCalls } from "./memory-calls";

export interface UsageReport {
  range: UsageRange;
  totals: UsageTotals;
  /** The chart's bars, oldest first. */
  buckets: UsageBucket[];
  /** True when Hindsight could not be read just now: memory then shows what was copied before. */
  memoryUnavailable: boolean;
}

/**
 * The user's usage for a period, as bars and totals, read from the ledger of model calls. The memory's latest calls are
 * copied from Hindsight first, so the page is up to date. Every cost is the one recorded when the call ran.
 */
export async function usageForUser(
  user: { id: string; username: string },
  range: UsageRange,
  now: Date,
): Promise<UsageReport> {
  let memoryUnavailable = false;
  try {
    await syncMemoryCalls(user);
  } catch (error) {
    console.warn("memory usage unavailable", { reason: error instanceof Error ? error.message : String(error) });
    memoryUnavailable = true;
  }

  const start = rangeStart(range, now);
  const rows = await getDb()
    .select({
      createdAt: modelCalls.createdAt,
      context: modelCalls.context,
      messageId: modelCalls.messageId,
      usage: modelCalls.usage,
    })
    .from(modelCalls)
    .where(and(eq(modelCalls.userId, user.id), start ? gte(modelCalls.createdAt, start) : undefined))
    .orderBy(asc(modelCalls.createdAt));

  const totals = emptyTotals();
  const buckets = new Map(emptyBuckets(range, now, rows[0]?.createdAt ?? null).map((bucket) => [bucket.key, bucket]));
  // A reply is one turn however many steps (rows) it took. Counted in the bar of its first step.
  const countedReplies = new Set<string>();

  for (const row of rows) {
    const bucket = buckets.get(bucketKey(range, row.createdAt));
    for (const [part, kinds] of partsOf(row.context)) {
      const { tokens, cost } = sum(row.usage, kinds);
      for (const target of [totals.parts[part], bucket?.parts[part]]) {
        if (!target) continue;
        target.tokens += tokens;
        target.costUsd += cost;
      }
    }
    if (row.context === "conversation" && row.messageId && !countedReplies.has(row.messageId)) {
      countedReplies.add(row.messageId);
      totals.turns += 1;
      if (bucket) bucket.turns += 1;
    }
  }

  return { range, totals, buckets: [...buckets.values()], memoryUnavailable };
}

const ALL_KINDS: ModelCallTokenKind[] = ["input", "cache_read", "cache_write", "output", "image_input", "image_output"];

/** The page's parts a call adds to, with the kinds of tokens each one takes. */
function partsOf(context: ModelCallContext): [UsagePart, ModelCallTokenKind[]][] {
  switch (context) {
    case "conversation":
      return [
        ["input", ["input", "cache_read", "cache_write"]],
        ["output", ["output"]],
      ];
    case "title":
      // Naming reads the user's message: the whole call counts as input.
      return [["input", ALL_KINDS]];
    case "image":
      return [["image", ALL_KINDS]];
    case "memory":
      return [["memory", ALL_KINDS]];
  }
}

function sum(usage: ModelCallUsage, kinds: ModelCallTokenKind[]): { tokens: number; cost: number } {
  let tokens = 0;
  let cost = 0;
  for (const kind of kinds) {
    tokens += usage[kind]?.tokens ?? 0;
    cost += usage[kind]?.cost ?? 0;
  }
  return { tokens, cost };
}
