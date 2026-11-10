"use client";

import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useContext, type FC } from "react";
import { ComposerAddAttachment, ComposerAttachments } from "@/components/assistant-ui/elements/attachment.aui";
import { ComposerQuotePreview } from "@/components/assistant-ui/elements/quote.aui";
import { ConversationIdContext } from "./conversation-context";

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
 * The message input box. Same shell and input styling as the Thread bundle's composer.
 * Files can be added with the attach button; they are uploaded to the conversation's sandbox when the message is sent.
 * Dictation is not supported by the backend, so it is not offered here.
 */
export const Composer: FC<{ autoFocus?: boolean }> = ({ autoFocus = false }) => {
  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col">
      <div
        data-slot="composer-shell"
        className="border-foreground/10 focus-within:border-foreground/25 flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color]"
      >
        <ComposerQuotePreview />
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="caret-primary placeholder:text-muted-foreground/60 max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none"
          rows={1}
          autoFocus={autoFocus}
          enterKeyHint="send"
          aria-label="Message input"
        />
        <div className="flex items-center justify-end gap-1.5">
          <ComposerAddAttachment />
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
    </ComposerPrimitive.Root>
  );
};
