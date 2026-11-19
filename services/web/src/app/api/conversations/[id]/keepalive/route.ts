import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { keepTemporaryConversationAlive } from "@/server/repositories/conversation-repository";

export const runtime = "nodejs";

/**
 * Called by a page that shows a temporary chat: when it opens, then every few minutes while it stays open. A temporary
 * chat nobody has kept alive for an hour is deleted. 404 when it is not one of the user's temporary chats, for example
 * because it has expired.
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "conversation not found" }, { status: 404 });

  if (!(await keepTemporaryConversationAlive(id, user.id))) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
