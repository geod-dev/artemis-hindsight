import { memorySummary } from "@/server/memory/memory-explorer";
import { explorerResponse } from "@/server/memory/explorer-route";

export const runtime = "nodejs";

/** How many observations, facts, experiences, entities and mental models the user's memory holds. */
export function GET(): Promise<Response> {
  return explorerResponse(memorySummary);
}
