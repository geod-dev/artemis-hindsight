"use client";

import { MessagePrimitive, useAuiState } from "@assistant-ui/react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useMemo, useState, type FC } from "react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { StoppedRun } from "@/components/assistant-ui/elements/stopped-run";
import { ghostButton } from "@/components/assistant-ui/elements/surfaces";
import { BotAvatar } from "@/components/avatar/bot-avatar";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";
import { sandboxMarkdownComponents } from "./sandbox-file-link";
import { RunActivityGroup } from "./run-activity-group";
import { ThinkingLabel } from "./thinking-label";
import { asTurnTiming, reasoningDuration, reasoningOrdinal, reasoningTiming } from "./turn-timing-view";

// Fenced code blocks highlight by their fence language; the rest of the markdown keeps the sandbox links.
const markdownComponents = { ...sandboxMarkdownComponents, SyntaxHighlighter: CodeBlock };

// One run per turn: every part before the final answer shares the "group-run" group, whatever its type.
// Grouping only some types split the run: a data part (such as "custom") between two tool calls
// started a new group. The final answer starts at the first text after the last tool call and stays outside the run;
// thinking between the last tool call and that text is part of the run. A message with no tool calls has no run.
const groupFor = (parts: readonly { type: string }[]) => {
  const lastToolIndex = parts.map((part) => part.type).lastIndexOf("tool-call");
  const answerStart = lastToolIndex === -1 ? 0 : parts.findIndex((part, index) => index > lastToolIndex && part.type === "text");
  const finalAnswer = new Set<unknown>(answerStart === -1 ? [] : parts.slice(answerStart));
  return (part: { type: string }) => (finalAnswer.has(part) ? [] : (["group-run"] as const));
};

/**
 * Our assistant message: text and tool runs, then a copy button.
 * A message stopped by the user shows the words that arrived before the stop, in StoppedRun.
 * Replaces the Thread bundle's AssistantMessage through the `AssistantMessage` slot.
 */
export const AssistantMessage: FC = () => {
  const [copied, setCopied] = useState(false);
  const isRunning = useAuiState((s) => s.message.status?.type === "running");
  const isLast = useAuiState((s) => s.message.isLast);
  const isCancelled = useAuiState(
    (s) => s.message.status?.type === "incomplete" && s.message.status.reason === "cancelled",
  );
  const text = useAuiState((s) =>
    s.message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n"),
  );
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const parts = useAuiState((s) => s.message.parts);
  const groupBy = useMemo(() => groupFor(parts), [parts]);
  const hasContent = parts.some(
    (part) => part.type === "reasoning" || part.type === "tool-call" || (part.type === "text" && part.text.trim() !== ""),
  );
  const rawTurnTiming = useAuiState((s) => s.message.metadata.custom?.turnTiming);
  const turnTiming = useMemo(() => asTurnTiming(rawTurnTiming), [rawTurnTiming]);

  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  };

  return (
    <MessagePrimitive.Root data-role="assistant" className="group fade-in slide-in-from-bottom-1 animate-in relative flex gap-2 duration-150">
      {/* The gutter is reserved on every assistant message, so the text does not shift when the avatar moves. */}
      <div className="flex w-7 shrink-0 justify-center pt-1">
        {isLast && (
          <div className="animate-in fade-in duration-300">
            <BotAvatar thinking={isRunning} size={28} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground pe-2 leading-relaxed wrap-break-word">
          <MessagePrimitive.GroupedParts groupBy={groupBy}>
            {({ part, children }) => {
              switch (part.type) {
                case "group-run":
                  return <RunActivityGroup group={part}>{children}</RunActivityGroup>;
                case "reasoning": {
                  // Thinking after the last tool call (or with no tools at all): a plain label, not a run.
                  const index = parts.indexOf(part as (typeof parts)[number]);
                  const timing = reasoningTiming(turnTiming, reasoningOrdinal(parts, index));
                  const durationMs = reasoningDuration(timing);
                  const live = isRunning && timing !== undefined && timing.endedAt === undefined;
                  return <ThinkingLabel durationMs={durationMs} live={live} />;
                }
                case "text":
                  // StoppedRun shows the same words itself, so the markdown text is not rendered twice.
                  return isCancelled ? (
                    <StoppedRun words={words} reason="stopped by you" />
                  ) : (
                    // Only the message text can be quoted; tool cards are outside this region.
                    <div data-aui-quote-selectable="">
                      <MarkdownText components={markdownComponents} />
                    </div>
                  );
                default:
                  return null;
              }
            }}
          </MessagePrimitive.GroupedParts>
          {/* Running with nothing yet: the model is starting, so show that it is thinking. */}
          {isRunning && !hasContent && <ThinkingLabel live />}
        </div>
        {!isRunning && (
          // Hidden until the pointer is over the message (or a key focuses the action), so the thread stays uncluttered.
          <div
            className={cn(
              "flex items-center gap-1 pe-2 pt-1.5 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
              copied ? "opacity-100" : "opacity-0",
            )}
          >
            <button
              type="button"
              aria-label="Copy response"
              onClick={copy}
              className={cn(ghostButton, "size-7")}
            >
              {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            </button>
          </div>
        )}
      </div>
    </MessagePrimitive.Root>
  );
};
