import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { ConversationServiceError, regenerateTitle } from "@/server/conversations/conversation-service";

export const runtime = "nodejs";

/**
 * Names the conversation again from the user's messages of the branch it is on, with the same naming task as a new
 * conversation. Answers `{ "title": "..." }` with the stored name.
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "invalid conversation id" }, { status: 400 });
  }
  try {
    return Response.json({ title: await regenerateTitle(user.id, id) });
  } catch (error) {
    if (error instanceof ConversationServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
