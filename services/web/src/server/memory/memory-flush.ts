import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import { and, asc, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { conversations, messages, projects, users } from "../db/schema";
import { retainTranscript, type TranscriptTurn } from "../clients/hindsight-client";
import { DEFAULT_TITLE, titleFrom } from "../repositories/conversation-repository";
import { CONVERSATION_STRATEGY, ensureBankTemplate } from "./bank-template";

// Moving a user's conversation messages into their Hindsight bank.
//
// A message is retained once: messages.memorized_at records when it reached the bank. A flush sends every message
// of one conversation that is not in memory yet, as one retain call. Each user has at most one active conversation;
// it is flushed when another conversation of the user receives a message, or after an hour without a new user message.
// Temporary chats never reach the bank: they are never made active, and a flush of one sends nothing.

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

  const turns = rows.flatMap((row): TranscriptTurn[] => {
    const text = textOfParts(row.parts);
    if (!text || (row.role !== "user" && row.role !== "assistant")) return [];
    return [{ role: row.role, content: text, timestamp: row.createdAt.toISOString() }];
  });

  if (turns.length > 0) {
    const source = await sourceOf(conversationId);
    if (source) {
      await ensureBankTemplate(username);
      await retainTranscript(username, {
        documentId: conversationId,
        turns,
        context: source.context,
        timestamp: source.startedAt,
        strategy: CONVERSATION_STRATEGY,
        operationId: operationIdFor(conversationId, rows.map((row) => row.id)),
      });
    }
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

/**
 * Flushes now every conversation of the user that has messages not in memory yet, the active one included, instead of
 * waiting for a switch or an hour of silence. A reply still streaming is left for the flush after its turn.
 * Returns how many conversations had something to save.
 */
export async function flushUnsavedConversations(userId: string, username: string): Promise<number> {
  const rows = await getDb()
    .selectDistinct({ id: messages.conversationId })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        eq(conversations.userId, userId),
        isNull(conversations.temporary),
        isNull(messages.memorizedAt),
        ne(messages.status, "streaming"),
      ),
    );
  for (const row of rows) await flushConversation(row.id, username);
  return rows.length;
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

/**
 * What Hindsight is told about the transcript: who talks and in which conversation (the retain `context`, which steers
 * extraction), and when the conversation started (the retain `timestamp`, which enables temporal recall).
 * Null when the conversation no longer exists, or is a temporary chat, which is never saved to memory.
 */
async function sourceOf(conversationId: string): Promise<{ context: string; startedAt: Date } | null> {
  const [row] = await getDb()
    .select({
      title: conversations.title,
      startedAt: conversations.createdAt,
      project: projects.name,
      temporary: conversations.temporary,
    })
    .from(conversations)
    .leftJoin(projects, eq(projects.id, conversations.projectId))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || row.temporary) return null;
  // The user is not named: the assistant already gets their name and username from the user metadata of every
  // conversation, and a name in the context was copied into the facts ("User (Ismael, username ismou) wants ...").
  // A conversation saved before it was named still carries its placeholder (the start of its first message), which
  // says nothing the transcript does not.
  const named = row.title !== DEFAULT_TITLE && row.title !== titleFrom(await firstUserText(conversationId));
  const conversation = named ? `, in the conversation "${row.title}"` : "";
  const project = row.project ? `, in their project "${row.project}"` : "";
  return {
    context: `Private chat between the user and Artemis, their self-hosted family assistant${conversation}${project}.`,
    startedAt: row.startedAt,
  };
}

async function firstUserText(conversationId: string): Promise<string> {
  const [row] = await getDb()
    .select({ parts: messages.parts })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "user")))
    .orderBy(asc(messages.position))
    .limit(1);
  return row ? textOfParts(row.parts) : "";
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
