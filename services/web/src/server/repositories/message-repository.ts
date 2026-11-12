import type { UIMessage } from "ai";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { messages, type MessageStatus, type StoredMessageMetadata, type StoredModelInput } from "../db/schema";

export type MessageRow = typeof messages.$inferSelect;

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

export interface SaveMessageInput {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  parts: UIMessage["parts"];
  metadata?: StoredMessageMetadata;
  status: MessageStatus;
}

/**
 * Inserts a message, or overwrites its content if it already exists. Called once per
 * streamed step, so the row always reflects the latest state of that message.
 * Position is assigned on first insert and never changes afterwards.
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
