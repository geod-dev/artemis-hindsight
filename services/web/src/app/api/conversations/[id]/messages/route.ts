import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { activeStreamOf } from "@/server/agent/turn-registry";
import { findConversation, setConversationUnread } from "@/server/repositories/conversation-repository";
import { listMessages } from "@/server/repositories/message-repository";
import { toUiMessages } from "@/lib/stored-messages";

export const runtime = "nodejs";

/**
 * The stored messages of one of the signed-in user's conversations, as UI messages. Opening a conversation reads
 * it: the unread flag is cleared. `activeStreamId` is set while a reply runs there, so this client can join it.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "conversation not found" }, { status: 404 });

  // Another user's conversation looks exactly like one that does not exist.
  const conversation = await findConversation(id, user.id);
  if (!conversation) return Response.json({ error: "conversation not found" }, { status: 404 });

  if (conversation.unread) await setConversationUnread(id, false);

  return Response.json({
    conversation: { id, title: conversation.title },
    messages: toUiMessages(await listMessages(id)),
    activeStreamId: activeStreamOf(id),
  });
}
