"use client";

import { TextMessagePartProvider, useAuiState } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { useEffect, useMemo, useState, type FC, type PropsWithChildren } from "react";
import {
  RunActivity,
  type RunActivityEntry,
  type RunActivityStatus,
} from "@/components/assistant-ui/elements/run-activity";
import type { MessagePrimitive } from "@assistant-ui/react";
import { ToolEntry } from "./tool-entry";
import { FILE_TOOLS, fileToolDetails, fileToolDoneIcon, fileToolLabel } from "./file-tool";
import { EXA_TOOLS, exaToolView } from "./exa-tool";
import { ThinkingLabel, thinkingText } from "./thinking-label";
import {
  asRecord,
  asTurnTiming,
  formatDuration,
  reasoningDuration,
  reasoningOrdinal,
  reasoningTiming,
} from "./turn-timing-view";

/**
 * Renders the turn's tool calls as one RunActivity, with the narration text between them as
 * commentary entries. Each tool call is one entry: a status icon (spinner while running, check when
 * done) and the `description` the model gave, which expands to the tool-call view with the command,
 * arguments and result. The label reads "Working 5s" while running and "Worked for 5m 32s" when done.
 * Children are intentionally not rendered, so each part appears once.
 */
export const RunActivityGroup: FC<PropsWithChildren<{ group: MessagePrimitive.GroupedParts.GroupPart }>> = ({ group }) => {
  const [open, setOpen] = useState(false);
  const parts = useAuiState((s) => s.message.parts);
  // The server measures the turn (see turn-timing.ts) and sends it with the message; the browser only displays it.
  const rawTurnTiming = useAuiState((s) => s.message.metadata.custom?.turnTiming);
  const turnTiming = useMemo(() => asTurnTiming(rawTurnTiming), [rawTurnTiming]);
  // The message's status, not the group's: a group ends between two tool steps, which is what made the label flicker.
  const messageRunning = useAuiState((s) => s.message.status?.type === "running");

  // The run is "answered" once text follows the last tool call: that text is the final answer.
  const lastToolIndex = parts.map((part) => part.type).lastIndexOf("tool-call");
  const answered = parts.slice(lastToolIndex + 1).some((part) => part.type === "text" && part.text.trim() !== "");
  const answerStartedAt = turnTiming?.steps.findLast((step) => step.firstTextAt !== undefined)?.firstTextAt;
  const working = messageRunning && !answered;

  // Ticks once a second while the message runs, so "Working Xs" counts up until the duration is fixed.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!messageRunning) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [messageRunning]);

  // Fixed once the answer starts, or once the message ends. Until then it runs live.
  const endedAt = answered ? answerStartedAt : messageRunning ? undefined : turnTiming?.endedAt;
  const end = endedAt ?? (messageRunning ? now : undefined);
  const durationMs = turnTiming === undefined || end === undefined ? undefined : end - turnTiming.startedAt;

  const entries: RunActivityEntry[] = group.indices.flatMap((index): RunActivityEntry[] => {
    const part = parts[index];
    if (!part) return [];
    if (part.type === "reasoning") {
      // Thinking inside a run: a plain line with its duration. It is an entry, but it does not expand.
      const timing = reasoningTiming(turnTiming, reasoningOrdinal(parts, index));
      const durationMs = reasoningDuration(timing);
      const live = messageRunning && timing !== undefined && timing.endedAt === undefined;
      return [
        {
          id: `thinking-${index}`,
          kind: "commentary",
          label: thinkingText(durationMs, live),
          content: <ThinkingLabel durationMs={durationMs} live={live} />,
        },
      ];
    }
    if (part.type === "text") {
      const narration = part.text.trim();
      if (!narration) return [];
      return [
        {
          id: `text-${index}`,
          kind: "commentary",
          label: narration,
          content: (
            <TextMessagePartProvider text={narration}>
              <MarkdownText />
            </TextMessagePartProvider>
          ),
        },
      ];
    }
    if (part.type !== "tool-call") return [];
    const args = asRecord(part.args);
    const finished = part.result !== undefined;
    const failed = part.isError === true;
    const isFile = FILE_TOOLS.has(part.toolName);
    // Exa calls show the query or the page title as label, with their own icon and result text.
    const exa = EXA_TOOLS.has(part.toolName) ? exaToolView(part.toolName, args, part.result) : undefined;
    const description =
      typeof args.description === "string" && args.description.trim()
        ? args.description.trim()
        : `Ran ${part.toolName}`;
    const label = isFile ? fileToolLabel(part.toolName, args.path, finished) : (exa?.label ?? description);
    const command = typeof args.command === "string" ? args.command : safeStringify(part.args);
    // File calls expand to a code diff; a failed call keeps the plain request and result, to show the error.
    const details = isFile && !failed ? fileToolDetails(part.toolName, args, part.result, finished) : undefined;
    return [
      {
        id: part.toolCallId,
        kind: "tool",
        label,
        content: (
          <ToolEntry
            label={label}
            request={command}
            result={exa ? exa.text : formatResult(part.result)}
            running={messageRunning && !finished}
            failed={failed}
            doneIcon={isFile ? fileToolDoneIcon(part.toolName) : "check"}
            icon={exa?.icon}
            details={details}
          />
        ),
      },
    ];
  });

  const status: RunActivityStatus = messageRunning ? "running" : "complete";

  return (
    <RunActivity
      status={status}
      statusLabel={working ? "Working" : "Worked for"}
      durationLabel={durationMs === undefined ? undefined : formatDuration(durationMs)}
      entries={entries}
      open={open}
      onOpenChange={setOpen}
      className={open ? "mb-2" : undefined}
    />
  );
};

/** Bash results are `{ exitCode, stdout, stderr, ... }`; show them as a terminal transcript. */
function formatResult(result: unknown): string {
  if (result === undefined || result === null) return "";
  const record = asRecord(result);
  if ("stdout" in record || "stderr" in record || "exitCode" in record) {
    const stdout = typeof record.stdout === "string" ? record.stdout : "";
    const stderr = typeof record.stderr === "string" ? record.stderr : "";
    const exit = record.exitCode === null || record.exitCode === undefined ? "" : `exit ${String(record.exitCode)}`;
    return [stdout.trimEnd(), stderr.trimEnd() && `[stderr]\n${stderr.trimEnd()}`, exit].filter(Boolean).join("\n");
  }
  return typeof result === "string" ? result : safeStringify(result);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "";
  }
}
