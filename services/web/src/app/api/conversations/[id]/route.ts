import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import {
  ConversationServiceError,
  deleteConversation,
  setArchived,
  setProject,
} from "@/server/conversations/conversation-service";

export const runtime = "nodejs";

// One change per request: archiving, or moving into a project (`projectId` null takes the conversation out of it).
const changeBody = z.union([z.object({ archived: z.boolean() }), z.object({ projectId: z.uuid().nullable() })]);

/**
 * Archives (`{ "archived": true }`), restores (`{ "archived": false }`), or moves one conversation into a project
 * (`{ "projectId": "<uuid>" }`) or out of its project (`{ "projectId": null }`).
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }
  const body = changeBody.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "send archived (true or false) or projectId (a project or null)" }, { status: 400 });
  }

  try {
    if ("archived" in body.data) await setArchived(user.id, id, body.data.archived);
    else await setProject(user.id, id, body.data.projectId);
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
