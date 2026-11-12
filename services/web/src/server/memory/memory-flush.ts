import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import { and, asc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { messages, users } from "../db/schema";
import { retainTranscript } from "../clients/hindsight-client";

// Moving a user's conversation messages into their Hindsight bank.
//
// A message is retained once: messages.memorized_at records when it reached the bank. A flush sends every message
// of one conversation that is not in memory yet, as one retain call. Each user has at most one active conversation;
// it is flushed when another conversation of the user receives a message, or after an hour without a new user message.

/** A conversation that has been silent this long is flushed. */
export const IDLE_FLUSH_MS = 60 * 60 * 1000;

/** Flushes of one conversation run one after another, so the same messages are never sent twice. */
const queues = new Map<string, Promise<void>>();

/**
 * Makes the conversation the user's active one. If another conversation was active, that one is flushed in the
 * background: the reply to the new message never waits for it.
 */
export async function activateConversation(userId: string, username: string, conversationId: string): Promise<void> {
  const previous = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ active: users.activeConversationId })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    await tx
      .update(users)
      .set({ activeConversationId: conversationId, activeConversationAt: sql`now()` })
      .where(eq(users.id, userId));
    return row?.active ?? null;
  });
  if (previous && previous !== conversationId) void flushConversation(previous, username);
}

/**
 * Called when a turn ends. If its conversation is no longer the active one, flush it now: messages that were still
 * streaming when the conversation was flushed (the reply to another conversation's message) reach memory here.
 */
export async function flushIfInactive(userId: string, username: string, conversationId: string): Promise<void> {
  try {
    const [row] = await getDb()
      .select({ active: users.activeConversationId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (row?.active !== conversationId) await flushConversation(conversationId, username);
  } catch (error) {
    console.warn("memory flush after turn failed", { conversationId, reason: reasonOf(error) });
  }
}

/** Sends the conversation's messages that are not in memory yet. Never rejects: a failure is logged and retried next flush. */
export function flushConversation(conversationId: string, username: string): Promise<void> {
  const previous = queues.get(conversationId) ?? Promise.resolve();
  const next = previous
    .then(() => flushNow(conversationId, username))
    .catch((error: unknown) => {
      console.warn("memory flush failed", { conversationId, reason: reasonOf(error) });
    });
  queues.set(conversationId, next);
  void next.finally(() => {
    if (queues.get(conversationId) === next) queues.delete(conversationId);
  });
  return next;
}

async function flushNow(conversationId: string, username: string): Promise<void> {
  const rows = await getDb()
    .select({ id: messages.id, role: messages.role, parts: messages.parts, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        isNull(messages.memorizedAt),
        ne(messages.status, "streaming"),
      ),
    )
    .orderBy(asc(messages.position));
  if (rows.length === 0) return;

  const lines = rows.flatMap((row) => {
    const text = textOfParts(row.parts);
    if (!text) return [];
    const speaker = row.role === "user" ? "User" : "Assistant";
    return [`${speaker} (${row.createdAt.toISOString()}): ${text}`];
  });

  if (lines.length > 0) {
    await retainTranscript(username, {
      documentId: conversationId,
      content: lines.join("\n"),
      operationId: operationIdFor(conversationId, rows.map((row) => row.id)),
    });
  }
  await getDb()
    .update(messages)
    .set({ memorizedAt: sql`now()` })
    .where(
      inArray(
        messages.id,
        rows.map((row) => row.id),
      ),
    );
}

/** Flushes the conversations whose last user message is an hour old, and forgets them as active. */
export async function flushIdleConversations(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - IDLE_FLUSH_MS);
  const idle = await getDb()
    .select({ id: users.id, username: users.username, conversationId: users.activeConversationId })
    .from(users)
    .where(and(isNotNull(users.activeConversationId), lt(users.activeConversationAt, cutoff)));

  for (const user of idle) {
    if (!user.conversationId) continue;
    // Only the first worker to clear the pointer flushes; the pointer is compared, so a newer active conversation is kept.
    const cleared = await getDb()
      .update(users)
      .set({ activeConversationId: null, activeConversationAt: null })
      .where(and(eq(users.id, user.id), eq(users.activeConversationId, user.conversationId)))
      .returning({ id: users.id });
    if (cleared.length > 0) await flushConversation(user.conversationId, user.username);
  }
}

/** The operation id is derived from the batch, so retrying the same batch is a no-op on the Hindsight side. */
function operationIdFor(conversationId: string, messageIds: string[]): string {
  const hex = createHash("sha256").update(`${conversationId}:${messageIds.join(",")}`).digest("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

function textOfParts(parts: UIMessage["parts"]): string {
  return parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("")
    .trim();
}

/** True while the conversation is the user's active one: its messages are saved to memory once it stops being active. */
export async function isActiveConversation(userId: string, conversationId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ active: users.activeConversationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.active === conversationId;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
