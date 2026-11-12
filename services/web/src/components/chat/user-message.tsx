"use client";

import { ActionBarPrimitive, MessagePrimitive, useAuiState } from "@assistant-ui/react";
import { CheckIcon, CopyIcon, PencilIcon } from "lucide-react";
import { useState, type FC } from "react";
import { UserMessageAttachments } from "@/components/assistant-ui/elements/attachment.aui";
import { QuoteBlock } from "@/components/assistant-ui/elements/quote.aui";
import { ghostButton } from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";
import { MessageDebugMenu } from "./message-debug-menu";

/**
 * A user message: the bubble, then a row of actions underneath (copy, edit and the debug menu), like the assistant's.
 * Editing starts the message's edit composer; the Thread renders that composer in place of the bubble.
 */
export const UserMessage: FC = () => {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const messageId = useAuiState((s) => s.message.id);
  const text = useAuiState((s) =>
    s.message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n"),
  );

  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  };

  return (
    <MessagePrimitive.Root
      data-role="user"
      data-aui-quote-selectable="false"
      className="group fade-in slide-in-from-bottom-1 animate-in flex flex-col items-end gap-1 duration-150"
    >
      <UserMessageAttachments />
      <div className="max-w-[80%] rounded-(--composer-radius) bg-primary px-4 py-2 text-primary-foreground wrap-break-word dark:bg-muted dark:text-foreground">
        <MessagePrimitive.Quote>{(quote) => <QuoteBlock {...quote} />}</MessagePrimitive.Quote>
        <MessagePrimitive.Parts />
      </div>
      {/* Hidden until the pointer is over the message (or a key focuses an action), so the row does not clutter the thread. */}
      <div
        className={cn(
          "flex items-center gap-1 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100",
          copied || menuOpen ? "opacity-100" : "opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Copy message"
          onClick={copy}
          className={cn(ghostButton, "size-7")}
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </button>
        <ActionBarPrimitive.Edit asChild>
          <button type="button" aria-label="Edit message" className={cn(ghostButton, "size-7")}>
            <PencilIcon className="size-3.5" />
          </button>
        </ActionBarPrimitive.Edit>
        <MessageDebugMenu messageId={messageId} onMenuOpenChange={setMenuOpen} />
      </div>
    </MessagePrimitive.Root>
  );
};
