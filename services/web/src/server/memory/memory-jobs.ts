import { consolidateBank, listBankIds } from "../clients/hindsight-client";
import { flushIdleConversations } from "./memory-flush";

// The background jobs of the memory, run by one timer in the web process:
//   - every minute: flush the conversations that have been idle for an hour. Each flush is claimed in the database
//     first, so a second process never repeats it.
//   - every day at 05:00 Paris time: consolidate every bank. Hindsight does not consolidate after a retain (see
//     HINDSIGHT_API_ENABLE_AUTO_CONSOLIDATION in docker-compose.yml), so this is what turns new facts into observations.

const TICK_MS = 60_000;
const CONSOLIDATION_TIME_ZONE = "Europe/Paris";
const CONSOLIDATION_HOUR = 5;

let running = false;
/** The Paris day the consolidation last started. In memory: a restart inside that hour may run it once more, which is harmless. */
let lastConsolidationDay: string | undefined;

/** Starts the timer once per process (Next.js dev hot reloads must not start a second one). */
export function startMemoryJobs(): void {
  const holder = globalThis as unknown as { __artemisMemoryJobs?: boolean };
  if (holder.__artemisMemoryJobs) return;
  holder.__artemisMemoryJobs = true;

  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await flushIdleConversations();
    const clock = parisClock(new Date());
    if (clock.hour === CONSOLIDATION_HOUR && clock.day !== lastConsolidationDay) {
      // Marked before it runs, so a failure does not restart it every minute within the hour.
      lastConsolidationDay = clock.day;
      await consolidateAllBanks();
    }
  } catch (error) {
    console.warn("memory jobs failed", { reason: error instanceof Error ? error.message : String(error) });
  } finally {
    running = false;
  }
}

/** Starts a consolidation on every bank. One bank failing does not stop the others. */
export async function consolidateAllBanks(): Promise<void> {
  const bankIds = await listBankIds();
  let started = 0;
  for (const bankId of bankIds) {
    try {
      await consolidateBank(bankId);
      started++;
    } catch (error) {
      console.warn("memory consolidation failed", { bankId, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  console.info("memory consolidation started", { banks: bankIds.length, started });
}

/** The calendar day and the hour (0-23) in Paris, for the given instant. */
function parisClock(now: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONSOLIDATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}
