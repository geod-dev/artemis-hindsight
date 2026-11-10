import type { UIMessage } from "ai";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChatPageFrame } from "@/components/chat/chat-page-frame";
import { ChatSession } from "@/components/chat/chat-session";
import { findConversation } from "@/server/repositories/conversation-repository";
import { listMessages } from "@/server/repositories/message-repository";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const conversation = await findConversation(id);
  if (!conversation) notFound();

  const rows = await listMessages(id);
  const initialMessages: UIMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: row.parts,
    metadata: {
      createdAt: row.createdAt.toISOString(),
      ...(row.metadata?.custom ? { custom: row.metadata.custom } : {}),
    },
  }));

  return (
    <ChatPageFrame>
      <ChatSession key={id} conversationId={id} initialMessages={initialMessages} isNewConversation={false} />
    </ChatPageFrame>
  );
}
