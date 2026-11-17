import type { ConversationProject, ConversationRow } from "../repositories/conversation-repository";

/** A conversation as the web sidebar and the mobile app receive it. Shared by every route that lists conversations. */
export interface ConversationJson {
  id: string;
  title: string;
  updatedAt: string;
  unread: boolean;
  /** The project the conversation belongs to, or null outside any project. */
  project: ConversationProject | null;
}

export function conversationJson(row: ConversationRow & { project?: ConversationProject | null }): ConversationJson {
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    unread: row.unread,
    project: row.project ?? null,
  };
}
