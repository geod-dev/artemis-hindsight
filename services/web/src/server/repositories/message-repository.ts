import type { UIMessage } from "ai";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { conversations, messages, type MessageStatus, type StoredMessageMetadata, type StoredModelInput } from "../db/schema";

export type MessageRow = typeof messages.$inferSelect;

/** Every message of the conversation, every branch included, in insertion order (parents before their children). */
export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  return getDb()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.position));
}

/** One message of a conversation, or undefined. The conversation id is part of the lookup, so a message never leaks across conversations. */
export async function findMessage(conversationId: string, messageId: string): Promise<MessageRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .limit(1);
  return row;
}

/** Records what the model received for a user message. Merged into the stored metadata, so the other keys stay. */
export async function setModelInput(messageId: string, modelInput: StoredModelInput): Promise<void> {
  await getDb()
    .update(messages)
    .set({
      metadata: sql`coalesce(${messages.metadata}, '{}'::jsonb) || ${JSON.stringify({ modelInput })}::jsonb`,
    })
    .where(eq(messages.id, messageId));
}

/**
 * The branch that ends at `leafId`: the messages from the first one down to the leaf, following each message's parent.
 * Empty when the leaf is null or not among the rows.
 */
export function branchTo<T extends { id: string; parentId: string | null }>(rows: readonly T[], leafId: string | null): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const branch: T[] = [];
  const seen = new Set<string>();
  for (let current = leafId ? byId.get(leafId) : undefined; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
    if (seen.has(current.id)) break; // a cycle cannot be stored, but a loop here would hang the server
    seen.add(current.id);
    branch.push(current);
  }
  return branch.reverse();
}

/**
 * The leaf the conversation opens on: the stored active leaf when it still exists, otherwise the last message stored.
 */
export function activeLeafOf(rows: readonly { id: string }[], activeLeafId: string | null): string | null {
  if (activeLeafId && rows.some((row) => row.id === activeLeafId)) return activeLeafId;
  return rows.at(-1)?.id ?? null;
}

/**
 * Makes `leafId` the end of the branch the conversation is on, and records the visit on that message. The message must
 * belong to the conversation; returns false when it does not.
 */
export async function setActiveLeaf(conversationId: string, leafId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const visited = await tx
      .update(messages)
      .set({ visitedAt: sql`now()` })
      .where(and(eq(messages.id, leafId), eq(messages.conversationId, conversationId)))
      .returning({ id: messages.id });
    if (visited.length === 0) return false;
    await tx.update(conversations).set({ activeLeafId: leafId }).where(eq(conversations.id, conversationId));
    return true;
  });
}

/**
 * Moves the active leaf from a user message to its reply, and records the visit on the reply. Compared with the
 * current leaf, so a leaf chosen meanwhile is kept.
 */
export async function advanceActiveLeaf(conversationId: string, fromId: string, toId: string): Promise<void> {
  const moved = await getDb()
    .update(conversations)
    .set({ activeLeafId: toId })
    .where(and(eq(conversations.id, conversationId), eq(conversations.activeLeafId, fromId)))
    .returning({ id: conversations.id });
  if (moved.length > 0) {
    await getDb().update(messages).set({ visitedAt: sql`now()` }).where(eq(messages.id, toId));
  }
}

export interface SaveMessageInput {
  id: string;
  conversationId: string;
  /** The message this one follows, or null for a first message. Set on insert only: a message never moves. */
  parentId: string | null;
  role: "user" | "assistant";
  parts: UIMessage["parts"];
  metadata?: StoredMessageMetadata;
  status: MessageStatus;
}

/**
 * Inserts a message, or overwrites its content if it already exists. Called once per
 * streamed step, so the row always reflects the latest state of that message.
 * Position and parent are assigned on first insert and never change afterwards.
 */
export async function saveMessage(input: SaveMessageInput): Promise<void> {
  const db = getDb();
  const position = sql<number>`(
    select coalesce(max(${messages.position}), -1) + 1
    from ${messages}
    where ${messages.conversationId} = ${input.conversationId}
  )`;
  await db
    .insert(messages)
    .values({
      id: input.id,
      conversationId: input.conversationId,
      role: input.role,
      parentId: input.parentId,
      position: sql`${position}`,
      parts: input.parts,
      metadata: input.metadata ?? null,
      status: input.status,
    })
    .onConflictDoUpdate({
      target: messages.id,
      set: {
        parts: input.parts,
        metadata: input.metadata ?? null,
        status: input.status,
        updatedAt: sql`now()`,
      },
    });
}
