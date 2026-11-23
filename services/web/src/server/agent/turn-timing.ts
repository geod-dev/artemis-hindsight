import type { StepUsage, TurnTiming } from "../db/schema";

/** The fields of the model's stream parts that the timing needs. */
type StreamPart = {
  type: string;
  finishReason?: string;
  text?: string;
  usage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number };
};

/** The step's tokens as stored, or undefined when the provider reported none. */
function usageOf(part: StreamPart): StepUsage | undefined {
  const { inputTokens, outputTokens, cachedInputTokens } = part.usage ?? {};
  if (inputTokens === undefined || outputTokens === undefined) return undefined;
  return {
    inputTokens,
    outputTokens,
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
  };
}

/**
 * The tokens of a whole reply: its steps' usage summed. Each step resends the prompt, so the sum is what the model
 * billed. Undefined when no step reported usage.
 */
export function usageOfTiming(timing: TurnTiming): StepUsage | undefined {
  let total: StepUsage | undefined;
  for (const step of timing.steps) {
    if (!step.usage) continue;
    total ??= { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
    total.inputTokens += step.usage.inputTokens;
    total.outputTokens += step.usage.outputTokens;
    total.cachedInputTokens = (total.cachedInputTokens ?? 0) + (step.usage.cachedInputTokens ?? 0);
  }
  return total;
}

export function createTurnTiming(startedAt: number): TurnTiming {
  return { startedAt, steps: [], reasonings: [] };
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
          const usage = usageOf(part);
          if (usage) current.usage = usage;
          onChange();
        } else if (part.type === "reasoning-start") {
          (timing.reasonings ??= []).push({ startedAt: Date.now() });
          onChange();
        } else if (part.type === "reasoning-end") {
          const open = timing.reasonings?.findLast((reasoning) => reasoning.endedAt === undefined);
          if (open) {
            open.endedAt = Date.now();
            onChange();
          }
        }
      },
    }),
  );
}
