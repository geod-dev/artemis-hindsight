import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { conversations } from "../db/schema";

export type ConversationRow = typeof conversations.$inferSelect;

export const DEFAULT_TITLE = "New conversation";

export async function listConversations(limit = 200): Promise<ConversationRow[]> {
  return getDb()
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function findConversation(id: string): Promise<ConversationRow | undefined> {
  const [row] = await getDb().select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return row;
}

/** Creates the conversation if it does not exist yet. The first user message becomes the title. */
export async function ensureConversation(id: string, firstUserText: string): Promise<ConversationRow> {
  const title = titleFrom(firstUserText);
  const [row] = await getDb()
    .insert(conversations)
    .values({ id, title })
    .onConflictDoUpdate({ target: conversations.id, set: { updatedAt: sql`now()` } })
    .returning();
  if (!row) throw new Error("failed to create conversation");
  return row;
}

export async function touchConversation(id: string): Promise<void> {
  await getDb().update(conversations).set({ updatedAt: sql`now()` }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: string): Promise<boolean> {
  const deleted = await getDb().delete(conversations).where(eq(conversations.id, id)).returning({ id: conversations.id });
  return deleted.length > 0;
}

function titleFrom(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return DEFAULT_TITLE;
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}
