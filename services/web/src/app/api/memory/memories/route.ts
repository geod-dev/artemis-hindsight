import { isMemoryType } from "@/lib/memory-explorer";
import { listMemories } from "@/server/memory/memory-explorer";
import { explorerResponse } from "@/server/memory/explorer-route";

export const runtime = "nodejs";

/** The user's memories of one type, with the links between them: GET /api/memory/memories?type=observation */
export function GET(req: Request): Promise<Response> {
  const type = new URL(req.url).searchParams.get("type");
  if (!isMemoryType(type)) {
    return Promise.resolve(Response.json({ error: "type must be observation, world or experience" }, { status: 400 }));
  }
  return explorerResponse((bankId) => listMemories(bankId, type));
}
