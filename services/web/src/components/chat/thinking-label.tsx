"use client";

import { formatDuration } from "./turn-timing-view";

/**
 * The words for one thinking block: "Thinking" while it runs, "Thought for 4s" once it has ended.
 * (The data keeps the name "reasoning"; only the interface says "thinking".)
 */
export function thinkingText(durationMs: number | undefined, live: boolean): string {
  if (live) return "Thinking";
  if (durationMs === undefined) return "Thought";
  if (durationMs < 1000) return "Thought for less than a second";
  return `Thought for ${formatDuration(durationMs)}`;
}

/** A thinking block: a plain indication with its duration. It does not expand. */
export function ThinkingLabel({ durationMs, live = false }: { durationMs?: number; live?: boolean }) {
  return (
    <p className="text-muted-foreground py-1 text-sm tabular-nums">{thinkingText(durationMs, live)}</p>
  );
}
