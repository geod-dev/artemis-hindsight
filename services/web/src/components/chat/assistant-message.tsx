"use client";

import { MessagePrimitive, useAuiState } from "@assistant-ui/react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useMemo, useState, type FC } from "react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { StoppedRun } from "@/components/assistant-ui/elements/stopped-run";
import { ghostButton } from "@/components/assistant-ui/elements/surfaces";
import { BotAvatar } from "@/components/avatar/bot-avatar";
import { cn } from "@/lib/utils";
import { sandboxMarkdownComponents } from "./sandbox-file-link";
import { RunActivityGroup } from "./run-activity-group";

// One run per turn: every part before the final answer shares the "group-run" group, whatever its type.
// Grouping only some types split the run: a data part (such as "custom") between two tool calls
// started a new group. The final answer, the parts after the last tool call, stays outside the run.
const groupFor = (parts: readonly { type: string }[]) => {
  const lastToolIndex = parts.map((part) => part.type).lastIndexOf("tool-call");
  const finalAnswer = new Set<unknown>(parts.slice(lastToolIndex + 1));
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

  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  };

  return (
    <MessagePrimitive.Root data-role="assistant" className="fade-in slide-in-from-bottom-1 animate-in relative flex gap-3 duration-150">
      {/* The gutter is reserved on every assistant message, so the text does not shift when the avatar moves. */}
      <div className="flex w-7 shrink-0 justify-center pt-1">
        {isLast && (
          <div className="animate-in fade-in duration-300">
            <BotAvatar thinking={isRunning} size={28} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground px-2 leading-relaxed wrap-break-word">
          <MessagePrimitive.GroupedParts groupBy={groupBy}>
            {({ part, children }) => {
              switch (part.type) {
                case "group-run":
                  return <RunActivityGroup group={part}>{children}</RunActivityGroup>;
                case "text":
                  // StoppedRun shows the same words itself, so the markdown text is not rendered twice.
                  return isCancelled ? (
                    <StoppedRun words={words} reason="stopped by you" />
                  ) : (
                    // Only the message text can be quoted; tool cards are outside this region.
                    <div data-aui-quote-selectable="">
                      <MarkdownText components={sandboxMarkdownComponents} />
                    </div>
                  );
                default:
                  return null;
              }
            }}
          </MessagePrimitive.GroupedParts>
        </div>
        {!isRunning && (
          <div className="flex items-center gap-1 px-2 pt-1.5">
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
