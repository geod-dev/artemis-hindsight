import { clearMemory } from "../memory/bank-template";
import { removeSession } from "../clients/toolbox-client";
import { stopTurn } from "../agent/turn-registry";
import { deleteAllProjects } from "../projects/project-service";
import {
  archiveAllConversations,
  conversationIdsOf,
  deleteAllConversations,
  deleteConversation as deleteOneConversation,
  DEFAULT_TITLE,
  findConversation,
  listTitledConversations,
  setConversationArchived,
  setConversationProject,
  setConversationTitle,
  titleFrom,
} from "../repositories/conversation-repository";
import { activeLeafOf, branchTo, listMessages, type MessageRow } from "../repositories/message-repository";
import { NAMING_INPUT_CHARS, nameConversation } from "../agent/conversation-title";
import { textOf } from "../agent/memory-context";
import { findProject } from "../repositories/project-repository";

// The conversation actions of the danger zone and the conversation menus. Every function takes the owner's id, so a
// user only ever changes their own chats. The web app and the mobile app both call the same routes.

/** A rule the caller broke or an outside service that failed. The message is safe to show to the user. */
export class ConversationServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Archives or restores one conversation. It leaves the list, or comes back to it, and keeps its messages. */
export async function setArchived(userId: string, id: string, archived: boolean): Promise<void> {
  const updated = await setConversationArchived(id, userId, archived);
  if (!updated) throw new ConversationServiceError("conversation not found", 404);
}

/**
 * Moves a conversation into one of the user's projects, or out of its project (`projectId` null). The project must be
 * the user's own: another user's project looks like one that does not exist.
 */
export async function setProject(userId: string, id: string, projectId: string | null): Promise<void> {
  if (projectId && !(await findProject(projectId, userId))) {
    throw new ConversationServiceError("project not found", 404);
  }
  const updated = await setConversationProject(id, userId, projectId);
  if (!updated) throw new ConversationServiceError("conversation not found", 404);
}

/** Renames a conversation with the title the user typed. */
export async function rename(userId: string, id: string, title: string): Promise<void> {
  const updated = await setConversationTitle(id, userId, title);
  if (!updated) throw new ConversationServiceError("conversation not found", 404);
}

/**
 * Names the conversation again with the naming task, from the user's messages of the branch it is on (not only the
 * first one). A long conversation is cut from its start: its latest messages say best what it is about now.
 * Returns the new title.
 */
export async function regenerateTitle(userId: string, id: string): Promise<string> {
  const conversation = await findConversation(id, userId);
  if (!conversation || conversation.temporary) throw new ConversationServiceError("conversation not found", 404);
  const rows = await listMessages(id);
  const text = userTexts(branchTo(rows, activeLeafOf(rows, conversation.activeLeafId)))
    .join("\n\n")
    .slice(-NAMING_INPUT_CHARS);
  if (!text) throw new ConversationServiceError("this conversation has no text to name it from", 400);
  const title = await nameConversation({ conversationId: id, userId, firstMessage: text });
  if (!title) throw new ConversationServiceError("the title could not be generated right now", 502);
  return title;
}

/**
 * Runs the naming task again for every conversation of the user that still has its placeholder title (the default one,
 * or the start of one of its messages): its naming failed when it was created. Archived conversations are included,
 * temporary chats are not. Returns how many were named and how many are left untitled.
 */
export async function nameUntitledConversations(userId: string): Promise<{ named: number; failed: number }> {
  const untitled: { id: string; title: string; text: string }[] = [];
  for (const { id, title } of await listTitledConversations(userId)) {
    const texts = userTexts(await listMessages(id));
    const isPlaceholder = title === DEFAULT_TITLE || texts.some((text) => titleFrom(text) === title);
    if (isPlaceholder && texts[0]) untitled.push({ id, title, text: texts[0] });
  }
  let named = 0;
  // A few at a time, so a long list does not hit the model's rate limit all at once.
  for (let start = 0; start < untitled.length; start += 4) {
    const batch = untitled.slice(start, start + 4);
    const titles = await Promise.all(
      batch.map(({ id, title, text }) => nameConversation({ conversationId: id, userId, placeholderTitle: title, firstMessage: text })),
    );
    named += titles.filter(Boolean).length;
  }
  return { named, failed: untitled.length - named };
}

/** The non-empty texts of the user's messages, in order. */
function userTexts(rows: MessageRow[]): string[] {
  return rows
    .filter((row) => row.role === "user")
    .map((row) => textOf({ id: row.id, role: "user", parts: row.parts }))
    .filter(Boolean);
}

/** Archives every listed conversation of the user. Returns how many were archived. */
export function archiveAll(userId: string): Promise<number> {
  return archiveAllConversations(userId);
}

/**
 * Deletes one conversation: its running reply is stopped, its sandbox folder removed, then its rows. A failure
 * before the rows are deleted leaves the conversation as it was, so the delete can be retried.
 */
export async function deleteConversation(userId: string, id: string): Promise<void> {
  if (!(await findConversation(id, userId))) throw new ConversationServiceError("conversation not found", 404);
  await removeChats([id]);
  await deleteOneConversation(id, userId);
}

/** Deletes every conversation of the user, archived or not. */
export async function deleteAllChats(userId: string): Promise<void> {
  await removeChats(await conversationIdsOf(userId));
  await deleteAllConversations(userId);
}

/**
 * Deletes everything the user has kept: every conversation, every project with its folder, then the whole memory bank.
 * The memory is cleared last and the chats are already gone when it is, so a retry after a failure only repeats the
 * memory step.
 */
export async function deleteAllData(user: { id: string; username: string }): Promise<void> {
  await deleteAllChats(user.id);
  await deleteAllProjects(user);
  try {
    await clearMemory(user.username);
  } catch (error) {
    console.warn("memory clear failed", { reason: reasonOf(error) });
    throw new ConversationServiceError("memory could not be cleared right now", 502);
  }
}

/** Stops the running replies of these conversations and removes their sandbox folders. The caller deletes the rows. */
async function removeChats(ids: string[]): Promise<void> {
  for (const id of ids) stopTurn(id);
  for (const id of ids) {
    try {
      await removeSession(id);
    } catch (error) {
      console.warn("sandbox folder removal failed", { conversationId: id, reason: reasonOf(error) });
      throw new ConversationServiceError("the files of this chat could not be removed right now", 502);
    }
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
