import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { listConversations } from "@/server/repositories/conversation-repository";

export const runtime = "nodejs";

/** The signed-in user's conversations, most recent first. */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await listConversations(user.id);
  return Response.json({
    conversations: rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString(), unread: c.unread })),
  });
}
