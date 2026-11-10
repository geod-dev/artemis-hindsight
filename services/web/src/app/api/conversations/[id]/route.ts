import { z } from "zod";
import { deleteConversation } from "@/server/repositories/conversation-repository";

export const runtime = "nodejs";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }
  const deleted = await deleteConversation(id);
  if (!deleted) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
