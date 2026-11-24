import type { LanguageModelUsage } from "ai";
import { getDb } from "../db/client";
import { modelCalls, type ModelCallCause, type ModelCallContext, type ModelCallOperation } from "../db/schema";
import { priceCall, type CallTokens } from "./prices";

// The ledger of model calls (see `modelCalls` in the schema). Every model call the app makes for a user is written here
// once, priced at the moment it ran.

export interface ModelCall {
  userId: string;
  /** The provider's id for the call, prefixed by its source: "anthropic:msg_…", "openai:…", "hindsight:…". */
  sourceKey: string;
  context: ModelCallContext;
  operation: ModelCallOperation;
  cause: ModelCallCause;
  /** The model as the provider named it in its answer. */
  model: string;
  tokens: CallTokens;
  conversationId?: string | null;
  messageId?: string | null;
  /** When the call ran. Now when omitted. */
  at?: Date;
}

/** The row of a call, priced. */
export function modelCallRow(call: ModelCall): typeof modelCalls.$inferInsert {
  const { usage, costUsd } = priceCall(call.model, call.tokens);
  return {
    userId: call.userId,
    sourceKey: call.sourceKey,
    context: call.context,
    operation: call.operation,
    cause: call.cause,
    model: call.model,
    usage,
    costUsd,
    conversationId: call.conversationId ?? null,
    messageId: call.messageId ?? null,
    ...(call.at ? { createdAt: call.at } : {}),
  };
}

/**
 * Writes one call to the ledger. A call already written (same source key) is left as it is. Best effort: a failed write
 * is logged and never reaches the caller, whose own work does not depend on it.
 */
export async function recordModelCall(call: ModelCall): Promise<void> {
  try {
    await getDb().insert(modelCalls).values(modelCallRow(call)).onConflictDoNothing({ target: modelCalls.sourceKey });
  } catch (error) {
    console.warn("model call not recorded", {
      sourceKey: call.sourceKey,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The tokens of an AI SDK call (Anthropic), split as the provider bills them: uncached input, cache reads, cache writes,
 * and output (reasoning included).
 */
export function tokensOfLanguageModel(usage: LanguageModelUsage): CallTokens {
  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0;
  const input = usage.inputTokenDetails.noCacheTokens ?? Math.max((usage.inputTokens ?? 0) - cacheRead - cacheWrite, 0);
  return { input, cacheRead, cacheWrite, output: usage.outputTokens ?? 0 };
}
