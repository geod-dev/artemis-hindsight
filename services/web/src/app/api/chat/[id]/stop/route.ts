import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { stopTurn } from "@/server/agent/turn-registry";
import { findConversation } from "@/server/repositories/conversation-repository";

export const runtime = "nodejs";

/** Stops the running turn of a conversation. Only the stop button calls this; closing the page does not. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid conversation id" }, { status: 400 });
  if (!(await findConversation(id, user.id))) return Response.json({ error: "conversation not found" }, { status: 404 });

  return stopTurn(id) ? new Response(null, { status: 204 }) : Response.json({ error: "no running turn" }, { status: 404 });
}
