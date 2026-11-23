import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { activeStreamOf } from "@/server/agent/turn-registry";
import { findConversation } from "@/server/repositories/conversation-repository";
import { setActiveLeaf } from "@/server/repositories/message-repository";

export const runtime = "nodejs";

const bodySchema = z.object({ leafId: z.string().min(1) });

/**
 * Records the branch the user switched to: `leafId` is the last message of the branch now shown. The conversation opens
 * on it next time, on every device, and memory follows it at the next save. Refused (409) while a reply runs: the
 * clients do not switch branches then, and the reply moves the leaf itself when it is stored.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "conversation not found" }, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid branch" }, { status: 400 });

  // Another user's conversation looks exactly like one that does not exist.
  if (!(await findConversation(id, user.id))) return Response.json({ error: "conversation not found" }, { status: 404 });
  if (activeStreamOf(id)) return Response.json({ error: "a reply is running" }, { status: 409 });

  if (!(await setActiveLeaf(id, parsed.data.leafId))) {
    return Response.json({ error: "message not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
