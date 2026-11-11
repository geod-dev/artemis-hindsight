/** The parts of the server's turn timing the browser shows. Anything malformed counts as no timing. */
export interface TurnTimingView {
  startedAt: number;
  endedAt?: number;
  steps: { firstTextAt?: number }[];
  reasonings: { startedAt: number; endedAt?: number }[];
}

/** Reads the server's turn timing from message metadata. */
export function asTurnTiming(value: unknown): TurnTimingView | undefined {
  const record = asRecord(value);
  if (typeof record.startedAt !== "number") return undefined;
  const steps = Array.isArray(record.steps)
    ? record.steps.map((step) => ({
        firstTextAt: typeof asRecord(step).firstTextAt === "number" ? (asRecord(step).firstTextAt as number) : undefined,
      }))
    : [];
  const reasonings = Array.isArray(record.reasonings)
    ? record.reasonings.flatMap((reasoning) => {
        const entry = asRecord(reasoning);
        if (typeof entry.startedAt !== "number") return [];
        return [
          {
            startedAt: entry.startedAt,
            ...(typeof entry.endedAt === "number" ? { endedAt: entry.endedAt } : {}),
          },
        ];
      })
    : [];
  return {
    startedAt: record.startedAt,
    ...(typeof record.endedAt === "number" ? { endedAt: record.endedAt } : {}),
    steps,
    reasonings,
  };
}

/**
 * Which reasoning block a part is, counting only reasoning parts before it. It matches the order of
 * TurnTiming.reasonings, which the server fills in stream order.
 */
export function reasoningOrdinal(parts: readonly { type: string }[], index: number): number {
  let ordinal = 0;
  for (let i = 0; i < index; i++) if (parts[i]?.type === "reasoning") ordinal++;
  return ordinal;
}

/** The timing of one reasoning block, or undefined for messages stored before reasoning was timed. */
export function reasoningTiming(timing: TurnTimingView | undefined, ordinal: number) {
  return timing?.reasonings[ordinal];
}

/** How long a reasoning block took, once it has ended. */
export function reasoningDuration(entry: { startedAt: number; endedAt?: number } | undefined): number | undefined {
  return entry?.endedAt === undefined ? undefined : entry.endedAt - entry.startedAt;
}

/** "3s" under a minute, then "5m 32s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
