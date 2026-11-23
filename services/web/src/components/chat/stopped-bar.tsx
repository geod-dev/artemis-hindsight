"use client";

import { useAui, useAuiState } from "@assistant-ui/react";
import { ArrowRightIcon, SquareIcon } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useContinuedReplies } from "./continued-replies";

/**
 * Under a reply the user stopped: "Stopped by you", and, on the last reply while nothing runs, its two ways out.
 *  - Discard: edit the message the reply answers. The thread scrolls to it and opens its edit card; sending makes a new
 *    branch, so the stopped reply stays in the old one.
 *  - Continue: the agent goes on with the stopped reply, in the same message. It runs as a regenerate of the question that
 *    names this reply (run config `custom.continueMessageId`); the server replays the reply and streams the rest into it.
 * The phone has the same row in apps/mobile/src/chat/message-view.tsx (StoppedRow).
 */
export const StoppedBar: FC = () => {
  const aui = useAui();
  const { markContinued } = useContinuedReplies();
  const isLast = useAuiState((s) => s.message.isLast);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const messageId = useAuiState((s) => s.message.id);
  const index = useAuiState((s) => s.thread.messages.findIndex((message) => message.id === s.message.id));
  const questionId = useAuiState((s) => (index > 0 ? (s.thread.messages[index - 1]?.id ?? null) : null));

  const discard = () => {
    if (index < 1) return;
    aui.thread().message({ index: index - 1 }).composer().beginEdit();
  };
  const resume = () => {
    if (!questionId) return;
    markContinued(messageId);
    aui.thread().startRun({ parentId: questionId, runConfig: { custom: { continueMessageId: messageId } } });
  };

  return (
    <div className="flex items-center gap-2 pe-2 pt-2">
      <Badge variant="secondary">
        <SquareIcon className="fill-current" />
        Stopped by you
      </Badge>
      {isLast && !isRunning && (
        <div className="ms-auto flex items-center gap-1.5">
          <Button variant="ghost" size="xs" onClick={discard} disabled={index < 1}>
            Discard
          </Button>
          <Button size="xs" onClick={resume} disabled={!questionId}>
            Continue
            <ArrowRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
};
