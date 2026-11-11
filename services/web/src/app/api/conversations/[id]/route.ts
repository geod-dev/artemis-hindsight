import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { deleteConversation } from "@/server/repositories/conversation-repository";

export const runtime = "nodejs";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }
  const deleted = await deleteConversation(id, user.id);
  if (!deleted) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
