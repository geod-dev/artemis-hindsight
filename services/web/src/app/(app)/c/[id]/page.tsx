import type { UIMessage } from "ai";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChatSession } from "@/components/chat/chat-session";
import { getCurrentUser } from "@/server/auth/session";
import { findConversation } from "@/server/repositories/conversation-repository";
import { listMessages } from "@/server/repositories/message-repository";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // Another user's conversation looks exactly like one that does not exist.
  const user = await getCurrentUser();
  if (!user) notFound();
  const conversation = await findConversation(id, user.id);
  if (!conversation) notFound();

  const rows = await listMessages(id);
  const initialMessages: UIMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: row.parts,
    metadata: {
      createdAt: row.createdAt.toISOString(),
      ...(row.metadata?.custom ? { custom: row.metadata.custom } : {}),
      // The turn's timing: the UI reads it from metadata.custom.turnTiming, where assistant-ui puts extra metadata.
      ...(row.metadata?.turnTiming ? { turnTiming: row.metadata.turnTiming } : {}),
    },
  }));

  return (
    <ChatSession
      key={id}
      conversationId={id}
      initialMessages={initialMessages}
      isNewConversation={false}
      initialTitle={conversation.title}
    />
  );
}
