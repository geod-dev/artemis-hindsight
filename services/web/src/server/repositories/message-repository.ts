import type { UIMessage } from "ai";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { messages, type MessageStatus, type StoredMessageMetadata } from "../db/schema";

export type MessageRow = typeof messages.$inferSelect;

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  return getDb()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.position));
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
