import { listEntities } from "@/server/memory/memory-explorer";
import { explorerResponse } from "@/server/memory/explorer-route";

export const runtime = "nodejs";

/** The entities of the user's memory and how often each pair is mentioned together. */
export function GET(): Promise<Response> {
  return explorerResponse(listEntities);
}
