import type { UIMessage } from "ai";
import type { TurnTiming } from "@/server/db/schema";
import { asRecord } from "./turn-timing-view";

type Part = UIMessage["parts"][number];

/** One model step of a turn, with what it produced. Times are epoch milliseconds, as the server measured them. */
export interface DebugStep {
  number: number;
  startedAt?: number;
  firstTextAt?: number;
  endedAt?: number;
  finishReason?: string;
  parts: DebugPart[];
}

export type DebugPart =
  | { kind: "reasoning"; startedAt?: number; endedAt?: number }
  | { kind: "tool"; name: string; state: string; input: unknown; output: unknown; errorText?: string }
  | { kind: "text"; text: string }
  | { kind: "other"; type: string };

/**
 * Splits a stored assistant message into its model steps. The AI SDK writes a "step-start" part before each step,
 * and the server's timing has one entry per step in the same order, so step k pairs with timing.steps[k].
 * Messages without step boundaries (stored before they were written) are one step.
 */
export function buildSteps(parts: readonly Part[], timing: TurnTiming | undefined): DebugStep[] {
  const groups: Part[][] = [];
  let current: Part[] | undefined;
  for (const part of parts) {
    if (part.type === "step-start" || current === undefined) {
      current = [];
      groups.push(current);
    }
    if (part.type !== "step-start") current.push(part);
  }

  let reasoningCount = 0;
  return groups.map((group, index) => {
    const entry = timing?.steps[index];
    const debugParts = group.flatMap((part): DebugPart[] => {
      if (part.type === "reasoning") {
        // The n-th reasoning part of the message is the n-th reasoning entry of the timing.
        const reasoning = timing?.reasonings?.[reasoningCount];
        reasoningCount++;
        return [{ kind: "reasoning", startedAt: reasoning?.startedAt, endedAt: reasoning?.endedAt }];
      }
      if (part.type === "text") {
        const text = part.text.trim();
        return text ? [{ kind: "text", text }] : [];
      }
      if (part.type.startsWith("data-")) return [];
      const tool = toolPartOf(part);
      return tool ? [tool] : [{ kind: "other", type: part.type }];
    });
    return {
      number: index + 1,
      startedAt: entry?.startedAt,
      firstTextAt: entry?.firstTextAt,
      endedAt: entry?.endedAt,
      finishReason: entry?.finishReason,
      parts: debugParts,
    };
  });
}

/** A tool call as the AI SDK stores it: "tool-<name>" for a known tool, "dynamic-tool" with its name otherwise. */
function toolPartOf(part: Part): DebugPart | undefined {
  const record = asRecord(part);
  const type = String(record.type);
  let name: string | undefined;
  if (type === "dynamic-tool") name = typeof record.toolName === "string" ? record.toolName : "tool";
  else if (type.startsWith("tool-")) name = type.slice("tool-".length);
  if (name === undefined) return undefined;
  return {
    kind: "tool",
    name,
    state: typeof record.state === "string" ? record.state : "unknown",
    input: record.input,
    output: record.output,
    ...(typeof record.errorText === "string" ? { errorText: record.errorText } : {}),
  };
}
