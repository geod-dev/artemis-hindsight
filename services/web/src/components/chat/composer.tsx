"use client";

import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { ArrowUpIcon, MicIcon, SquareIcon } from "lucide-react";
import { useContext, useEffect, useRef, type FC, type RefObject } from "react";
import { ComposerAddAttachment, ComposerAttachments } from "@/components/assistant-ui/elements/attachment.aui";
import { ComposerQuotePreview } from "@/components/assistant-ui/elements/quote.aui";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { ConversationIdContext } from "./conversation-context";

// Same look as the attach button, so the row of icon buttons reads as one.
const iconButtonClass =
  "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full active:scale-[0.96] motion-reduce:transition-none";

/**
 * Stops the running turn on the server, then cancels the local stream. Only this button stops a turn:
 * leaving or reloading the page does not.
 */
const StopButton: FC = () => {
  const conversationId = useContext(ConversationIdContext);
  return (
    <ComposerPrimitive.Cancel asChild>
      <button
        type="button"
        aria-label="Stop generating"
        onClick={() => {
          if (conversationId) void fetch(`/api/chat/${conversationId}/stop`, { method: "POST" });
        }}
        className="bg-foreground text-background flex size-7 items-center justify-center rounded-full"
      >
        <SquareIcon className="size-3 fill-current" />
      </button>
    </ComposerPrimitive.Cancel>
  );
};

/** Starts dictation; while a session runs, the same slot becomes a stop button. */
const DictationButton: FC = () => (
  <>
    <AuiIf condition={(s) => s.composer.dictation == null}>
      <ComposerPrimitive.Dictate asChild>
        <TooltipIconButton
          tooltip="Dictate"
          side="bottom"
          variant="ghost"
          size="icon"
          className={iconButtonClass}
          aria-label="Dictate"
        >
          <MicIcon className="size-4" />
        </TooltipIconButton>
      </ComposerPrimitive.Dictate>
    </AuiIf>
    <AuiIf condition={(s) => s.composer.dictation != null}>
      <ComposerPrimitive.StopDictation asChild>
        <TooltipIconButton
          tooltip="Stop dictation"
          side="bottom"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 size-7 animate-pulse rounded-full motion-reduce:animate-none"
          aria-label="Stop dictation"
        >
          <SquareIcon className="size-3 fill-current" />
        </TooltipIconButton>
      </ComposerPrimitive.StopDictation>
    </AuiIf>
  </>
);

/**
 * With nothing focused, a printable key moves focus to the input, so typing anywhere on the page starts a message.
 * Keys with Ctrl, Cmd or Alt are left alone, and so is typing into another field.
 */
function useTypeToFocus(inputRef: RefObject<HTMLTextAreaElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.isContentEditable || active.matches("input, textarea, select"))) return;
      const input = inputRef.current;
      if (!input || input.disabled) return;
      input.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, inputRef]);
}

/**
 * The message input box. Same shell and input styling as the Thread bundle's composer.
 * Files are added with the attach button (left) and uploaded to the conversation's sandbox when the message is sent.
 * Dictation records here and is transcribed by the server.
 * `typeToFocus` makes a keypress with nothing focused move focus into this input (used for the main composer).
 */
export const Composer: FC<{ autoFocus?: boolean; typeToFocus?: boolean }> = ({
  autoFocus = false,
  typeToFocus = false,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useTypeToFocus(inputRef, typeToFocus);

  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col">
      <div
        data-slot="composer-shell"
        className="border-foreground/10 focus-within:border-foreground/25 flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color]"
      >
        <ComposerQuotePreview />
        <ComposerAttachments />
        <ComposerPrimitive.Input
          ref={inputRef}
          placeholder="Send a message..."
          className="caret-primary placeholder:text-muted-foreground/60 max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none"
          rows={1}
          autoFocus={autoFocus}
          enterKeyHint="send"
          aria-label="Message input"
        />
        <div className="flex items-center justify-between gap-1.5">
          <ComposerAddAttachment />
          <div className="flex items-center gap-1.5">
            <DictationButton />
            <AuiIf condition={(s) => s.composer.canCancel}>
              <StopButton />
            </AuiIf>
            <AuiIf condition={(s) => !s.composer.canCancel}>
              <ComposerPrimitive.Send asChild>
                <button
                  type="button"
                  aria-label="Send message"
                  className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full"
                >
                  <ArrowUpIcon className="size-4" />
                </button>
              </ComposerPrimitive.Send>
            </AuiIf>
          </div>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
};
