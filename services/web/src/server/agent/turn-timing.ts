import type { TurnTiming } from "../db/schema";

/** The fields of the model's stream parts that the timing needs. */
type StreamPart = { type: string; finishReason?: string; text?: string };

export function createTurnTiming(startedAt: number): TurnTiming {
  return { startedAt, steps: [] };
}

/** A copy that is safe to store and to send: later changes to the live timing do not alter it. */
export function snapshotTiming(timing: TurnTiming): TurnTiming {
  return JSON.parse(JSON.stringify(timing)) as TurnTiming;
}

/**
 * Passes the model's stream through unchanged while recording the turn's timing: when each step
 * starts, when its first text arrives and when it ends. `onChange` runs after every recorded change,
 * so the browser gets the same numbers the database gets.
 */
export function observeTurnTiming<T extends StreamPart>(
  source: ReadableStream<T>,
  timing: TurnTiming,
  onChange: () => void,
): ReadableStream<T> {
  return source.pipeThrough(
    new TransformStream<T, T>({
      transform(part, controller) {
        controller.enqueue(part);
        const current = timing.steps.at(-1);
        if (part.type === "start-step") {
          timing.steps.push({ startedAt: Date.now() });
          onChange();
        } else if (part.type === "text-delta" && current && current.firstTextAt === undefined) {
          current.firstTextAt = Date.now();
          onChange();
        } else if (part.type === "finish-step" && current) {
          current.endedAt = Date.now();
          current.finishReason = part.finishReason;
          onChange();
        }
      },
    }),
  );
}
