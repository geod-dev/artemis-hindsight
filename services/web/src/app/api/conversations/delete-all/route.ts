import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { ConversationServiceError, deleteAllChats } from "@/server/conversations/conversation-service";

export const runtime = "nodejs";

/** Deletes every conversation of the user, archived or not. The memory is kept (see DELETE /api/me/data). */
export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    await deleteAllChats(user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConversationServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
