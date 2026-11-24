// Next.js runs this once when the server starts. It starts the memory jobs (idle flushes and the daily consolidation at
// 05:00 Paris), the copy of the memory's model calls into the ledger every 15 minutes, and the hourly deletion of the
// temporary chats nobody keeps alive.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMemoryJobs } = await import("./server/memory/memory-jobs");
  const { startMemoryCallSync } = await import("./server/usage/memory-calls");
  const { startTemporaryChatSweep } = await import("./server/conversations/temporary-chats");
  startMemoryJobs();
  startMemoryCallSync();
  startTemporaryChatSweep();
}
