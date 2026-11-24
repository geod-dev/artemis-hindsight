import { and, eq, max } from "drizzle-orm";
import { listModelCalls, type HindsightModelCall } from "../clients/hindsight-client";
import { getDb } from "../db/client";
import { modelCalls, users, type ModelCallCause, type ModelCallOperation } from "../db/schema";
import { modelCallRow } from "./model-calls";

// The memory's model calls run inside Hindsight (retain, consolidation and summary refreshes run in its background
// workers), so the app cannot record them as they end. This job copies them from Hindsight's request log into the
// ledger: every 15 minutes for every user, and for one user before their usage page is read. A call already copied is
// skipped (its source key is Hindsight's request id).

const SYNC_MS = 15 * 60 * 1000;
/**
 * How far before the last copied call the next copy starts reading. Hindsight logs a call when it ends, with the time it
 * started: a long call can land in the log after a shorter one that started later.
 */
const OVERLAP_MS = 6 * 60 * 60 * 1000;

/** What each Hindsight operation is in the ledger, and why it runs. */
const OPERATIONS: Record<string, { operation: ModelCallOperation; cause: ModelCallCause }> = {
  // A conversation is saved to memory once it stops being the active one (memory-flush.ts).
  retain: { operation: "retain", cause: "conversation_inactive" },
  // The recall before each user message. The agent's recall tool lands here too: the log does not tell them apart.
  recall: { operation: "recall", cause: "message_sent" },
  // Only the agent's reflect tool calls reflect.
  reflect: { operation: "reflect", cause: "tool_call" },
  // The daily consolidation, and the refresh of the memory summaries it triggers.
  consolidation: { operation: "consolidate", cause: "recurrent_task" },
  refresh_mental_model: { operation: "refresh", cause: "recurrent_task" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Starts the copy every 15 minutes, once per process (Next.js dev hot reloads must not start a second one). */
export function startMemoryCallSync(): void {
  const holder = globalThis as unknown as { __artemisMemoryCallSync?: boolean };
  if (holder.__artemisMemoryCallSync) return;
  holder.__artemisMemoryCallSync = true;

  const timer = setInterval(() => void syncAllMemoryCalls(), SYNC_MS);
  timer.unref?.();
}

async function syncAllMemoryCalls(): Promise<void> {
  const all = await getDb().select({ id: users.id, username: users.username }).from(users);
  for (const user of all) {
    try {
      await syncMemoryCalls(user);
    } catch (error) {
      console.warn("memory calls not copied", { userId: user.id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
}

/** Copies the user's new memory calls into the ledger. Throws when Hindsight cannot be read. */
export async function syncMemoryCalls(user: { id: string; username: string }): Promise<void> {
  const [last] = await getDb()
    .select({ at: max(modelCalls.createdAt) })
    .from(modelCalls)
    .where(and(eq(modelCalls.userId, user.id), eq(modelCalls.context, "memory")));
  const since = last?.at ? new Date(last.at.getTime() - OVERLAP_MS) : null;

  // The bank is named after the username.
  const rows = (await listModelCalls(user.username, since)).flatMap((call) => {
    const row = toRow(user.id, call);
    return row ? [row] : [];
  });
  // In chunks: a first copy can hold thousands of calls, more than one statement's parameters allow.
  for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
    await getDb()
      .insert(modelCalls)
      .values(rows.slice(start, start + INSERT_CHUNK))
      .onConflictDoNothing({ target: modelCalls.sourceKey });
  }
}

const INSERT_CHUNK = 500;

const unknownOperations = new Set<string>();

function toRow(userId: string, call: HindsightModelCall) {
  if (call.inputTokens + call.outputTokens + call.thoughtsTokens === 0) return null;
  const kind = call.operation ? OPERATIONS[call.operation] : undefined;
  if (!kind) {
    const name = call.operation ?? "none";
    if (!unknownOperations.has(name)) {
      unknownOperations.add(name);
      console.warn("memory call not copied: unknown Hindsight operation", { operation: name });
    }
    return null;
  }
  return modelCallRow({
    userId,
    sourceKey: `hindsight:${call.id}`,
    context: "memory",
    ...kind,
    model: call.model,
    tokens: {
      input: Math.max(call.inputTokens - call.cachedTokens, 0),
      cacheRead: call.cachedTokens,
      output: call.outputTokens + call.thoughtsTokens,
    },
    conversationId: call.documentId && UUID.test(call.documentId) ? call.documentId : null,
    at: call.startedAt,
  });
}
