import { z } from "zod";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { forgetMemory } from "@/server/clients/hindsight-client";

export const runtime = "nodejs";

/** Forgets one memory of the user's bank. */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "invalid memory id" }, { status: 400 });
  }

  try {
    const forgotten = await forgetMemory(user.username, id);
    if (!forgotten) return Response.json({ error: "memory not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn("memory delete failed", { reason: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "this memory could not be deleted right now" }, { status: 502 });
  }
}
