import { getCurrentUser, unauthorized } from "@/server/auth/session";

/**
 * The shared body of the memory explorer's routes (app/api/memory/*): the signed-in user (cookie or bearer token),
 * their bank, a 404 when `read` finds nothing, and a 502 when Hindsight cannot answer.
 */
export async function explorerResponse(read: (bankId: string) => Promise<unknown>): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await read(user.username);
    if (body === null) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(body);
  } catch (error) {
    console.warn("memory explorer unavailable", { reason: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "memory is unavailable right now" }, { status: 502 });
  }
}
