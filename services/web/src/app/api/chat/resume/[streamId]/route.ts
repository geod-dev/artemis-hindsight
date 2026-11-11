import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { resumable, streamOwner } from "@/server/agent/turn-registry";

export const runtime = "nodejs";

/**
 * Replays a turn from its first chunk and then follows it live. The browser calls this after a reload,
 * with the stream id it saved from the turn's response. 404 once the turn has been forgotten, and for
 * turns that another user started.
 */
export async function GET(_req: Request, context: { params: Promise<{ streamId: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { streamId } = await context.params;
  if (streamOwner(streamId) !== user.id) return Response.json({ error: "no such turn" }, { status: 404 });

  const body = await resumable.resume(streamId);
  if (!body) return Response.json({ error: "no such turn" }, { status: 404 });
  return new Response(body, { headers: UI_MESSAGE_STREAM_HEADERS });
}
