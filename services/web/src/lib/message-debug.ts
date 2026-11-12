import type { UIMessage } from "ai";
import type { MessageStatus, StoredMessageMetadata, StoredModelInput, TurnTiming } from "@/server/db/schema";

/**
 * What the message debug view shows for one message: the stored message, what it recalled or what the model
 * read, and the turn's timing. Served by /api/conversations/[id]/messages/[messageId]/debug.
 */
export interface MessageDebug {
  id: string;
  role: "user" | "assistant";
  status: MessageStatus;
  /** ISO time the message was stored. */
  createdAt: string;
  /** ISO time the message reached the user's memory bank. Null while it has not been saved. */
  memorizedAt: string | null;
  /** Whether the conversation is still the user's active one. Its messages are saved once it is not. */
  conversationActive: boolean;
  model?: string;
  /** The stored parts, as the AI SDK wrote them (tool calls, reasoning, text and step boundaries). */
  parts: UIMessage["parts"];
  /** User messages: the memory recalled for them. */
  memory?: StoredMessageMetadata["memory"];
  /** User messages: the exact input the model read. */
  modelInput?: StoredModelInput;
  /** Assistant messages: the turn's timing, measured by the server. */
  turnTiming?: TurnTiming;
}
