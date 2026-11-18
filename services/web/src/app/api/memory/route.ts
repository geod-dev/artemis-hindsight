import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { clearMemory } from "@/server/memory/bank-template";

export const runtime = "nodejs";

/** Erases everything the user's memory holds. */
export async function DELETE(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await clearMemory(user.username);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn("memory clear failed", { reason: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "memory could not be cleared right now" }, { status: 502 });
  }
}
