import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import { and, asc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { conversations, messages, projects, users } from "../db/schema";
import { retainTranscript, type TranscriptTurn } from "../clients/hindsight-client";
import { DEFAULT_TITLE, titleFrom } from "../repositories/conversation-repository";
import { activeLeafOf, branchTo } from "../repositories/message-repository";
import { CONVERSATION_STRATEGY, ensureBankTemplate } from "./bank-template";

// Moving a user's conversation messages into their Hindsight bank.
//
// Memory holds one branch of each conversation (see messages.parentId): conversations.memorized_leaf_id is the last
// message of the branch in the bank. A flush saves the active branch, the one that ends at conversations.active_leaf_id,
// in one retain call:
//  - nothing, when that branch is the one in memory;
//  - an append of the messages after the memorized leaf, when the active branch continues it (the whole branch on the
//    first save);
//  - a replace of the conversation's document with the whole branch, when the user left the memorized branch (an edit,
//    a regenerated reply, a switch to another branch). Hindsight then drops what only the abandoned branch said.
// messages.memorized_at records when a message was last sent, for the debug view. Each user has at most one active conversation;
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
  const [conversation] = await getDb()
    .select({ activeLeafId: conversations.activeLeafId, memorizedLeafId: conversations.memorizedLeafId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conversation) return;
  const all = await getDb()
    .select({
      id: messages.id,
      parentId: messages.parentId,
      role: messages.role,
      parts: messages.parts,
      status: messages.status,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.position));

  // The active branch. A reply still streaming is left for the flush after its turn: the branch stops before it.
  const branch = branchTo(all, activeLeafOf(all, conversation.activeLeafId));
  while (branch.at(-1)?.status === "streaming") branch.pop();
  const leaf = branch.at(-1);
  if (!leaf || leaf.id === conversation.memorizedLeafId) return;

  // Append what follows the memorized leaf when the branch continues it (everything on the first save); replace the
  // document with the whole branch when the user left the memorized branch.
  const memorizedIndex = conversation.memorizedLeafId
    ? branch.findIndex((row) => row.id === conversation.memorizedLeafId)
    : -1;
  const mode = conversation.memorizedLeafId && memorizedIndex === -1 ? "replace" : "append";
  const rows = mode === "replace" ? branch : branch.slice(memorizedIndex + 1);

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
        operationId: operationIdFor(conversationId, mode, rows.map((row) => row.id)),
        mode,
      });
    }
  }
  await getDb().transaction(async (tx) => {
    if (rows.length > 0) {
      await tx
        .update(messages)
        .set({ memorizedAt: sql`now()` })
        .where(
          inArray(
            messages.id,
            rows.map((row) => row.id),
          ),
        );
    }
    await tx.update(conversations).set({ memorizedLeafId: leaf.id }).where(eq(conversations.id, conversationId));
  });
}

/**
 * Flushes now every conversation of the user whose active branch is not the one in memory, the active conversation
 * included, instead of waiting for a switch or an hour of silence. A reply still streaming is left for the flush after
 * its turn. Returns how many conversations were flushed.
 */
export async function flushUnsavedConversations(userId: string, username: string): Promise<number> {
  const rows = await getDb()
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        isNull(conversations.temporary),
        isNotNull(conversations.activeLeafId),
        sql`${conversations.activeLeafId} is distinct from ${conversations.memorizedLeafId}`,
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

/**
 * The operation id of an append is derived from the batch, so retrying the same batch is a no-op on the Hindsight side.
 * A replace gets a new id every time: going back to a branch saved before must replace again, and Hindsight would answer
 * a repeated id with the old operation. Resending a whole branch is harmless; unchanged chunks are not re-extracted.
 */
function operationIdFor(conversationId: string, mode: "append" | "replace", messageIds: string[]): string {
  if (mode === "replace") return crypto.randomUUID();
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
