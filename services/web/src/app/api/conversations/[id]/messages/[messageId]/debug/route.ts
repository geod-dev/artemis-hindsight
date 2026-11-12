import { z } from "zod";
import type { MessageDebug } from "@/lib/message-debug";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { findConversation } from "@/server/repositories/conversation-repository";
import { findMessage } from "@/server/repositories/message-repository";
import { isActiveConversation } from "@/server/memory/memory-flush";

export const runtime = "nodejs";

/** The stored message with what the debug view needs: memory, model input, timing and its memory status. */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id, messageId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.string().min(1).max(200).safeParse(messageId).success) {
    return Response.json({ error: "invalid conversation or message id" }, { status: 400 });
  }
  // Another user's conversation looks exactly like one that does not exist.
  const conversation = await findConversation(id, user.id);
  if (!conversation) return Response.json({ error: "conversation not found" }, { status: 404 });

  const row = await findMessage(id, messageId);
  if (!row) return Response.json({ error: "message not found" }, { status: 404 });

  const body: MessageDebug = {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    memorizedAt: row.memorizedAt?.toISOString() ?? null,
    conversationActive: await isActiveConversation(user.id, id),
    ...(row.metadata?.model ? { model: row.metadata.model } : {}),
    parts: row.parts,
    ...(row.metadata?.memory ? { memory: row.metadata.memory } : {}),
    ...(row.metadata?.modelInput ? { modelInput: row.metadata.modelInput } : {}),
    ...(row.metadata?.turnTiming ? { turnTiming: row.metadata.turnTiming } : {}),
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
