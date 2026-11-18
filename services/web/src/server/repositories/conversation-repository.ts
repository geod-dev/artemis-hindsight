import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { conversations, projects } from "../db/schema";
import { announceListChange } from "../events/list-events";

export type ConversationRow = typeof conversations.$inferSelect;

/** The project a conversation belongs to, as the lists show it. */
export interface ConversationProject {
  id: string;
  name: string;
  color: string;
}

export type ConversationListItem = ConversationRow & { project: ConversationProject | null };

export const DEFAULT_TITLE = "New conversation";

/** A conversation id that already belongs to another user. Never revealed to the caller as "exists". */
export class ConversationOwnershipError extends Error {}

// Every function here takes the owner's id. A conversation is only ever read or changed by the user who owns it.

/** The user's listed conversations, or their archived ones, most recent first, each with its project when it has one. */
export async function listConversations(userId: string, archived = false, limit = 200): Promise<ConversationListItem[]> {
  const rows = await getDb()
    .select({
      conversation: conversations,
      projectId: projects.id,
      projectName: projects.name,
      projectColor: projects.color,
    })
    .from(conversations)
    .leftJoin(projects, eq(projects.id, conversations.projectId))
    .where(and(eq(conversations.userId, userId), archivedFilter(archived)))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
  return rows.map(({ conversation, projectId, projectName, projectColor }) => ({
    ...conversation,
    project: projectId && projectName && projectColor ? { id: projectId, name: projectName, color: projectColor } : null,
  }));
}

/**
 * The listed conversations of one project, most recent first. `total` counts all of them, for "see more" controls.
 * Archived conversations are left out, as they are in the main list.
 */
export async function listProjectConversations(
  userId: string,
  projectId: string,
  limit: number,
  offset: number,
): Promise<{ conversations: ConversationRow[]; total: number }> {
  const scope = and(eq(conversations.userId, userId), eq(conversations.projectId, projectId), isNull(conversations.archivedAt));
  const [rows, [count]] = await Promise.all([
    getDb().select().from(conversations).where(scope).orderBy(desc(conversations.updatedAt)).limit(limit).offset(offset),
    getDb().select({ total: sql<number>`count(*)::int` }).from(conversations).where(scope),
  ]);
  return { conversations: rows, total: count?.total ?? 0 };
}

function archivedFilter(archived: boolean) {
  return archived ? isNotNull(conversations.archivedAt) : isNull(conversations.archivedAt);
}

/** Sets or clears the archive flag. Returns false when the conversation is not the user's. */
export async function setConversationArchived(id: string, userId: string, archived: boolean): Promise<boolean> {
  const updated = await getDb()
    .update(conversations)
    .set({ archivedAt: archived ? sql`now()` : null })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  if (updated.length > 0) announceListChange(userId);
  return updated.length > 0;
}

/**
 * Puts the conversation in a project, or takes it out of its project (`projectId` null). Its place in the lists does
 * not change: moving a conversation is not an interaction. Returns false when the conversation is not the user's.
 */
export async function setConversationProject(id: string, userId: string, projectId: string | null): Promise<boolean> {
  const updated = await getDb()
    .update(conversations)
    .set({ projectId })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  if (updated.length > 0) announceListChange(userId);
  return updated.length > 0;
}

/** Archives every listed conversation of the user. Returns how many were archived. */
export async function archiveAllConversations(userId: string): Promise<number> {
  const updated = await getDb()
    .update(conversations)
    .set({ archivedAt: sql`now()` })
    .where(and(eq(conversations.userId, userId), isNull(conversations.archivedAt)))
    .returning({ id: conversations.id });
  if (updated.length > 0) announceListChange(userId);
  return updated.length;
}

export async function findConversation(id: string, userId: string): Promise<ConversationRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return row;
}

/**
 * True when the id is free or already belongs to this user, so the caller may use it.
 * False when another user owns it.
 */
export async function canUseConversation(id: string, userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ userId: conversations.userId })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return !row || row.userId === userId;
}

/**
 * Creates the conversation if it does not exist yet. The first user message becomes the placeholder title, and
 * `created` says whether this call created it (the naming step only runs for a new conversation).
 * A new conversation takes the project it is created in; an existing one keeps its project.
 * A message sent to an archived conversation takes it back into the list.
 */
export async function ensureConversation(
  id: string,
  userId: string,
  firstUserText: string,
  projectId: string | null = null,
): Promise<{ title: string; created: boolean; projectId: string | null }> {
  const title = titleFrom(firstUserText);
  const [row] = await getDb()
    .insert(conversations)
    .values({ id, userId, title, projectId })
    .onConflictDoUpdate({
      target: conversations.id,
      set: { updatedAt: sql`now()`, archivedAt: null },
      setWhere: eq(conversations.userId, userId),
    })
    // xmax is 0 for a row this statement inserted and non-zero for a row it updated.
    .returning({ title: conversations.title, created: sql<boolean>`(xmax = 0)`, projectId: conversations.projectId });
  if (!row) throw new ConversationOwnershipError("conversation belongs to another user");
  return row;
}

/**
 * Replaces the placeholder title with the generated name. Only applies while the title is still the placeholder,
 * so a name that was changed in the meantime is never overwritten. Returns false when nothing changed.
 */
export async function renameUntitledConversation(
  id: string,
  userId: string,
  placeholderTitle: string,
  title: string,
): Promise<boolean> {
  const updated = await getDb()
    .update(conversations)
    .set({ title })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId), eq(conversations.title, placeholderTitle)))
    .returning({ id: conversations.id });
  if (updated.length > 0) announceListChange(userId);
  return updated.length > 0;
}

/**
 * Moves the conversation to the top of the lists: a turn touched it. Announced, so the other windows and devices list it
 * in its new place. The caller has checked that the conversation belongs to the user.
 */
export async function touchConversation(id: string, userId: string): Promise<void> {
  await getDb().update(conversations).set({ updatedAt: sql`now()` }).where(eq(conversations.id, id));
  announceListChange(userId);
}

export async function deleteConversation(id: string, userId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  if (deleted.length > 0) announceListChange(userId);
  return deleted.length > 0;
}

/** Deletes every conversation of the user, archived or not. Their messages go with them (cascade). */
export async function deleteAllConversations(userId: string): Promise<void> {
  await getDb().delete(conversations).where(eq(conversations.userId, userId));
  announceListChange(userId);
}

/** Every conversation id of a user, for cleanup when the user is deleted. */
export async function conversationIdsOf(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.userId, userId));
  return rows.map((row) => row.id);
}

/** The placeholder title a message gives a new conversation. */
export function titleFrom(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return DEFAULT_TITLE;
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

/**
 * Sets the unread flag. Callers have already checked that the conversation belongs to the user: this only writes.
 * Unread means a reply finished while nobody was connected to read it; opening the conversation clears it. Announced
 * only when the flag actually changes, so opening a read conversation does not refresh the lists.
 */
export async function setConversationUnread(id: string, userId: string, unread: boolean): Promise<void> {
  const changed = await getDb()
    .update(conversations)
    .set({ unread })
    .where(and(eq(conversations.id, id), ne(conversations.unread, unread)))
    .returning({ id: conversations.id });
  if (changed.length > 0) announceListChange(userId);
}
