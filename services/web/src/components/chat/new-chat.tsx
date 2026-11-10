"use client";

import { useState } from "react";
import { ChatSession } from "./chat-session";

/** The new-chat view. The conversation id is created here and stored by the server with the first message. */
export function NewChat() {
  const [conversationId] = useState(() => crypto.randomUUID());
  return <ChatSession conversationId={conversationId} initialMessages={[]} isNewConversation />;
}
