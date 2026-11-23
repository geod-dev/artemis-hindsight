"use client";

import { ComposerPrimitive, useAui, useAuiState } from "@assistant-ui/react";
import { ArrowUpIcon } from "lucide-react";
import { useContext, useEffect, useRef, useState, type FC, type KeyboardEvent } from "react";
import { ComposerAddAttachment } from "@/components/assistant-ui/elements/attachment.aui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ComposerAttachments } from "./composer-attachments";
import { sendButtonClass } from "./composer";
import { EditEffortContext, EffortMenu, isEffort, savedEffort, type ReasoningEffort } from "./effort-picker";

/**
 * Edit state of a user message, in place of its bubble: a card with the composer's look, holding the message's edit
 * composer (aui.composer is that message's edit composer here). Text, files (attach, remove) and the reasoning effort,
 * which starts at the effort the message was sent with. Sending makes a new branch beside the message; Cancel or Escape
 * leaves the message as it was.
 *
 * While a reply runs, the card can be edited but not sent: the send button is dimmed and says to stop the reply first.
 * The composer's stop button stays where it is.
 */
export const UserEditMessage: FC = () => {
  const aui = useAui();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const editEffort = useContext(EditEffortContext);
  const sentWith = useAuiState((s) => s.message.metadata.custom?.reasoningEffort);
  const [effort, setEffort] = useState<ReasoningEffort>(() => (isEffort(sentWith) ? sentWith : savedEffort()));
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const canSend = useAuiState((s) => s.composer.canSend);
  const disabled = isRunning || !canSend;

  // The card is brought into view (an edit can start from far below, as Discard does), then the input is focused with the
  // caret after the text. preventScroll: the focus must not jump past the smooth scroll.
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const send = () => {
    if (disabled) return;
    // Read once by the transport for this request, in place of the composer's effort.
    if (editEffort) editEffort.current = effort;
    aui.composer.send();
  };

  // Enter sends through `send`, so the effort is set first; Shift+Enter adds a line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <div ref={cardRef} className="flex w-full justify-end">
      <div
        data-slot="composer-shell"
        className="border-foreground/10 focus-within:border-foreground/25 flex w-[85%] cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color]"
      >
        <ComposerAttachments />
        <ComposerPrimitive.Input
          ref={inputRef}
          submitMode="none"
          onKeyDown={onKeyDown}
          className="caret-primary max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 pt-1.5 pb-1 text-base leading-6 outline-none"
          rows={1}
          aria-label="Edit message"
        />
        <div className="flex items-center gap-1.5">
          <ComposerAddAttachment />
          <EffortMenu value={effort} onChange={setEffort} />
          <div className="flex-1" />
          <ComposerPrimitive.Cancel asChild>
            <Button variant="pill" size="xs">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          {isRunning ? (
            // A disabled button gets no pointer events: the tooltip sits on a wrapper that can be hovered and focused.
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="rounded-full">
                  <button type="button" aria-label="Send edit" disabled className={sendButtonClass}>
                    <ArrowUpIcon className="size-4" />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">Stop the reply to send your edit</TooltipContent>
            </Tooltip>
          ) : (
            <button type="button" aria-label="Send edit" disabled={disabled} onClick={send} className={sendButtonClass}>
              <ArrowUpIcon className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
