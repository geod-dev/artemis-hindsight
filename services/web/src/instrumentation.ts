// Next.js runs this once when the server starts. It starts the memory jobs (idle flushes and the daily consolidation at 05:00 Paris).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMemoryJobs } = await import("./server/memory/memory-jobs");
  startMemoryJobs();
}
