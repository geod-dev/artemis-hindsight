import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { conversationJson } from "@/server/conversations/conversation-json";
import { listConversations } from "@/server/repositories/conversation-repository";

export const runtime = "nodejs";

/**
 * The signed-in user's conversations, most recent first. The list is the active ones; `?archived=true` gives the
 * archived ones instead (the danger zone's archived chats page).
 */
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const archived = new URL(req.url).searchParams.get("archived") === "true";
  const rows = await listConversations(user.id, archived);
  return Response.json({ conversations: rows.map(conversationJson) });
}
