/**
 * The stream part that carries a conversation's name, once the naming model has answered. Same value as the server
 * sends (services/web/src/lib/conversation-title-part.ts): the app reads it while the turn streams.
 */
export const CONVERSATION_TITLE_PART = "data-conversation-title" as const;

export interface ConversationTitleData {
  title: string;
}
