import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { flushUnsavedConversations } from "@/server/memory/memory-flush";

export const runtime = "nodejs";

/**
 * Saves to memory now every conversation of the user with messages not in memory yet, instead of waiting for the
 * user to switch conversation or for an hour of silence. Answers once the retains are submitted (Hindsight extracts the
 * facts in the background), with how many conversations were flushed. A failed flush is logged and retried later.
 */
export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const conversations = await flushUnsavedConversations(user.id, user.username);
    return Response.json({ conversations });
  } catch (error) {
    console.warn("memory flush failed", { reason: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "conversations could not be saved to memory right now" }, { status: 502 });
  }
}
