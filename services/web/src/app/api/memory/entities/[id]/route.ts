import { z } from "zod";
import { entityDetail } from "@/server/memory/memory-explorer";
import { explorerResponse } from "@/server/memory/explorer-route";

export const runtime = "nodejs";

/** One entity of the user's memory, the memories that mention it and the entities mentioned with it. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "invalid entity id" }, { status: 400 });
  return explorerResponse((bankId) => entityDetail(bankId, id));
}
