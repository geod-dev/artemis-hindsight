import { mentalModelDetail } from "@/server/memory/memory-explorer";
import { explorerResponse } from "@/server/memory/explorer-route";

export const runtime = "nodejs";

/** Mental model ids are lowercase letters, digits and hyphens (bank-template.ts). */
const MODEL_ID = /^[a-z0-9-]{1,100}$/;

/** One mental model of the user's memory, with its configuration and earlier versions. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  if (!MODEL_ID.test(id)) return Response.json({ error: "invalid mental model id" }, { status: 400 });
  return explorerResponse((bankId) => mentalModelDetail(bankId, id));
}
