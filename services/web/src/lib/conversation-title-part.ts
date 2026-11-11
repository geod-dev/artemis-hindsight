/**
 * The stream part that carries a conversation's name, once the naming model has answered. The server sends it as a
 * transient part: the browser reads it while the turn streams, and it is never stored with the messages.
 * Shared by the server (writes it) and the browser (reads it), so it imports nothing.
 */
export const CONVERSATION_TITLE_PART = "data-conversation-title" as const;

export interface ConversationTitleData {
  title: string;
}
