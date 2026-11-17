import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { ConversationServiceError, deleteAllData } from "@/server/conversations/conversation-service";
import { ProjectServiceError } from "@/server/projects/project-service";

export const runtime = "nodejs";

/** Deletes everything the user has kept: every conversation, every project and the whole memory. The account stays. */
export async function DELETE(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    await deleteAllData(user);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConversationServiceError || error instanceof ProjectServiceError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
