import type { UIMessage } from "ai";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChatSession } from "@/components/chat/chat-session";
import { getCurrentUser } from "@/server/auth/session";
import { findConversation, setConversationUnread } from "@/server/repositories/conversation-repository";
import { listMessages } from "@/server/repositories/message-repository";
import { activeStreamOf } from "@/server/agent/turn-registry";
import { toUiMessages } from "@/lib/stored-messages";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // Another user's conversation looks exactly like one that does not exist.
  const user = await getCurrentUser();
  if (!user) notFound();
  const conversation = await findConversation(id, user.id);
  if (!conversation) notFound();

  // Opening the conversation reads it.
  if (conversation.unread) await setConversationUnread(id, false);

  const initialMessages: UIMessage[] = toUiMessages(await listMessages(id));

  return (
    <ChatSession
      key={id}
      conversationId={id}
      initialMessages={initialMessages}
      isNewConversation={false}
      initialTitle={conversation.title}
      activeStreamId={activeStreamOf(id)}
    />
  );
}
