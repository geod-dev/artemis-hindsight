import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { getMemoryGraph } from "@/server/clients/hindsight-client";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    return Response.json(await getMemoryGraph(user.username));
  } catch (error) {
    console.warn("memory graph unavailable", { reason: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "memory is unavailable right now" }, { status: 502 });
  }
}
