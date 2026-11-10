"use client";

import { ActionBarPrimitive, MessagePrimitive, useAuiState } from "@assistant-ui/react";
import { CheckIcon, CopyIcon, PencilIcon } from "lucide-react";
import { useState, type FC } from "react";
import { UserMessageAttachments } from "@/components/assistant-ui/elements/attachment.aui";
import { QuoteBlock } from "@/components/assistant-ui/elements/quote.aui";
import { ghostButton } from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";

/**
 * A user message: the bubble, then a row of actions underneath (copy and edit), like the assistant's.
 * Editing starts the message's edit composer; the Thread renders that composer in place of the bubble.
 */
export const UserMessage: FC = () => {
  const [copied, setCopied] = useState(false);
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
      className="fade-in slide-in-from-bottom-1 animate-in flex flex-col items-end gap-1 duration-150"
    >
      <UserMessageAttachments />
      <div className="bg-muted text-foreground max-w-[80%] rounded-(--composer-radius) px-4 py-2 wrap-break-word">
        <MessagePrimitive.Quote>{(quote) => <QuoteBlock {...quote} />}</MessagePrimitive.Quote>
        <MessagePrimitive.Parts />
      </div>
      <div className="flex items-center gap-1">
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
      </div>
    </MessagePrimitive.Root>
  );
};
