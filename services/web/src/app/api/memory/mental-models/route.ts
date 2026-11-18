import { listMentalModels } from "@/server/memory/memory-explorer";
import { explorerResponse } from "@/server/memory/explorer-route";

export const runtime = "nodejs";

/** The mental models of the user's memory: the summaries kept up to date after each consolidation. */
export function GET(): Promise<Response> {
  return explorerResponse(listMentalModels);
}
