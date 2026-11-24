import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { nameUntitledConversations } from "@/server/conversations/conversation-service";

export const runtime = "nodejs";

/**
 * Runs the naming task again for every conversation of the user still on its placeholder title (its naming failed).
 * Answers once they are all tried, with `{ "named": n, "failed": n }`. Called from the web developer settings.
 */
export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json(await nameUntitledConversations(user.id));
}
