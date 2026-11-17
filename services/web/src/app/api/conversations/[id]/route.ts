import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { ConversationServiceError, deleteConversation, setArchived } from "@/server/conversations/conversation-service";

export const runtime = "nodejs";

const archiveBody = z.object({ archived: z.boolean() });

/** Archives (`{ "archived": true }`) or restores (`{ "archived": false }`) one conversation. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }
  const body = archiveBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "archived must be true or false" }, { status: 400 });

  try {
    await setArchived(user.id, id, body.data.archived);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConversationServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }
  try {
    await deleteConversation(user.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConversationServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
