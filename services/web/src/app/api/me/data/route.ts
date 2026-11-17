import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { ConversationServiceError, deleteAllData } from "@/server/conversations/conversation-service";

export const runtime = "nodejs";

/** Deletes everything the user has kept: every conversation and the whole memory. The account itself stays. */
export async function DELETE(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    await deleteAllData(user);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConversationServiceError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
