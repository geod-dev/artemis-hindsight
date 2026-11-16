"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "./turn-timing-view";

/**
 * The words for one thinking block: "Thinking 3s" while it runs (just "Thinking" before its start is known),
 * "Thought for 4s" once it has ended. While live, `durationMs` is the time elapsed so far.
 * (The data keeps the name "reasoning"; only the interface says "thinking".)
 */
export function thinkingText(durationMs: number | undefined, live: boolean): string {
  if (live) return durationMs === undefined ? "Thinking" : `Thinking ${formatDuration(durationMs)}`;
  if (durationMs === undefined) return "Thought";
  if (durationMs < 1000) return "Thought for less than a second";
  return `Thought for ${formatDuration(durationMs)}`;
}

/** Elapsed milliseconds since `startedAt`, updated every second while `live`. */
function useElapsed(startedAt: number | undefined, live: boolean): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live || startedAt === undefined) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live, startedAt]);
  return live && startedAt !== undefined ? Math.max(0, now - startedAt) : undefined;
}

/**
 * A thinking block: a spinner and "Thinking 3s" while it runs, then plain text "Thought for 4s" once it has ended.
 * The spinner uses the tool rows' icon slot, so it lines up with them in a run. It does not expand.
 */
export function ThinkingLabel({
  durationMs,
  live = false,
  startedAt,
}: {
  durationMs?: number;
  live?: boolean;
  /** When the thinking started; while live, the label counts up from it. */
  startedAt?: number;
}) {
  const elapsed = useElapsed(startedAt, live);
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 py-1 text-sm tabular-nums">
      {live && (
        // Nudged 1px down like the tool rows' icon, so it sits on the text's center.
        <span className="flex w-4 shrink-0 translate-y-px items-center justify-center">
          <LoaderCircleIcon aria-hidden="true" className="size-3.5 animate-spin" />
        </span>
      )}
      {thinkingText(live ? elapsed : durationMs, live)}
    </p>
  );
}
