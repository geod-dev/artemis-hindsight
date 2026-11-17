import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { archiveAll } from "@/server/conversations/conversation-service";

export const runtime = "nodejs";

/** Archives every listed conversation of the user. Answers with how many were archived. */
export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ archived: await archiveAll(user.id) });
}
