"use client";

import { AuiIf, ComposerPrimitive, useAuiState } from "@assistant-ui/react";
import { ArrowUpIcon, MicIcon, SquareIcon, XIcon } from "lucide-react";
import { useContext, useEffect, useRef, type FC, type RefObject } from "react";
import { ComposerAddAttachment, ComposerAttachments } from "@/components/assistant-ui/elements/attachment.aui";
import { ComposerQuotePreview } from "@/components/assistant-ui/elements/quote.aui";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { ConversationIdContext } from "./conversation-context";
import { EffortPicker } from "./effort-picker";
import { DictationWaveform } from "./dictation-waveform";
import { useDictation } from "./use-dictation";

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

/**
 * Solid primary when there is text, an attachment or a dictation. Empty, it is disabled and gets the shadcn
 * disabled look (dimmed), the same as every other shadcn button.
 */
const SendButton: FC = () => {
  const canSend = useAuiState((s) => s.composer.canSend);
  return (
    <ComposerPrimitive.Send asChild>
      <button
        type="button"
        aria-label="Send message"
        disabled={!canSend}
        className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <ArrowUpIcon className="size-4" />
      </button>
    </ComposerPrimitive.Send>
  );
};

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
 * Dictation turns the bottom bar into: cancel (left), live waveform, stop (transcribe), send (transcribe and send).
 * `typeToFocus` makes a keypress with nothing focused move focus into this input (used for the main composer).
 */
export const Composer: FC<{ autoFocus?: boolean; typeToFocus?: boolean; modelPicker?: boolean }> = ({
  autoFocus = false,
  typeToFocus = false,
  modelPicker = false,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useTypeToFocus(inputRef, typeToFocus);
  const dictation = useDictation(inputRef);
  const dictating = dictation.phase !== "idle";
  const busy = dictation.phase === "transcribing";

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
        <div className="flex items-center gap-1.5">
          {dictating ? (
            <TooltipIconButton
              tooltip="Cancel dictation"
              side="bottom"
              variant="ghost"
              size="icon"
              type="button"
              className={iconButtonClass}
              aria-label="Cancel dictation"
              onClick={dictation.cancel}
            >
              <XIcon className="size-4" />
            </TooltipIconButton>
          ) : (
            <div className="flex items-center gap-1.5">
              <ComposerAddAttachment />
              {modelPicker && <EffortPicker />}
            </div>
          )}

          <div className="flex min-w-0 flex-1 items-center">
            {dictating && <DictationWaveform seconds={dictation.seconds} muted={busy} />}
          </div>

          {dictating ? (
            <div className="flex items-center gap-1.5">
              <TooltipIconButton
                tooltip="Stop dictation"
                side="bottom"
                variant="ghost"
                size="icon"
                type="button"
                disabled={busy}
                className={iconButtonClass}
                aria-label="Stop dictation"
                onClick={() => dictation.stop(false)}
              >
                <SquareIcon className="size-3 fill-current" />
              </TooltipIconButton>
              <button
                type="button"
                aria-label="Send dictated message"
                disabled={busy}
                onClick={() => dictation.stop(true)}
                className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full disabled:opacity-50"
              >
                <ArrowUpIcon className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <TooltipIconButton
                tooltip="Dictate"
                side="bottom"
                variant="ghost"
                size="icon"
                className={iconButtonClass}
                type="button"
                aria-label="Dictate"
                onClick={dictation.start}
              >
                <MicIcon className="size-4" />
              </TooltipIconButton>
              <AuiIf condition={(s) => s.composer.canCancel}>
                <StopButton />
              </AuiIf>
              <AuiIf condition={(s) => !s.composer.canCancel}>
                <SendButton />
              </AuiIf>
            </div>
          )}
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
};
