import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { consolidateBank, pendingConsolidation } from "@/server/clients/hindsight-client";
import { ensureBankTemplate } from "@/server/memory/bank-template";

export const runtime = "nodejs";

/**
 * Starts the consolidation of the user's memory now, instead of waiting for the daily 05:00 job: the facts not
 * consolidated yet become observations, and the mental models refresh after it. Same steps as the job (memory-jobs.ts).
 * Answers at once with how many facts it takes; the work runs in the background in Hindsight.
 */
export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await ensureBankTemplate(user.username);
    const pending = await pendingConsolidation(user.username);
    const operationId = await consolidateBank(user.username);
    return Response.json({ operationId, pending });
  } catch (error) {
    console.warn("memory consolidation failed", { reason: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "memory consolidation could not start right now" }, { status: 502 });
  }
}
