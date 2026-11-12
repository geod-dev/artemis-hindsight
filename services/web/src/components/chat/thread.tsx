"use client";

import { AuiIf, ThreadPrimitive, useAuiState } from "@assistant-ui/react";
import { ArrowDownIcon } from "lucide-react";
import { useContext, type CSSProperties, type FC } from "react";
import { SelectionToolbar } from "@/components/assistant-ui/elements/quote.aui";
import { ghostButton } from "@/components/assistant-ui/elements/surfaces";
import { Mascot } from "@/components/mascot/mascot";
import { cn } from "@/lib/utils";
import { AssistantMessage } from "./assistant-message";
import { Composer } from "./composer";
import { DayHeader, dayOf, MessageTimesContext } from "./day-header";
import { UserEditMessage } from "./user-edit-message";
import { UserMessage } from "./user-message";

/**
 * The conversation view. Empty: the composer sits centered. With messages: the thread scrolls and the
 * composer is docked at the bottom.
 */
export const Thread: FC = () => {
  const isEmpty = useAuiState((s) => s.thread.messages.length === 0);

  return (
    <ThreadPrimitive.Root
      className="bg-background flex h-full flex-col"
      style={
        {
          ["--thread-max-width" as string]: "44rem",
          ["--composer-bg" as string]: "color-mix(in oklab, var(--color-muted) 30%, transparent)",
          ["--composer-radius" as string]: "1rem",
          ["--composer-padding" as string]: "8px",
        } as CSSProperties
      }
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
            // Empty: avatar and composer are centered above the middle, so the pair sits higher on the page.
            isEmpty && "justify-center pb-[20vh]",
          )}
        >
          <div className="mb-14 flex flex-col gap-y-3 empty:hidden">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter
            className={cn(
              "bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
              !isEmpty && "sticky bottom-0 mt-auto",
            )}
          >
            <ThreadScrollToBottom />
            {isEmpty && (
              <div className="animate-in fade-in zoom-in-95 flex justify-center duration-300">
                <Mascot size={96} label="Assistant" />
              </div>
            )}
            <Composer autoFocus typeToFocus modelPicker />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
      <SelectionToolbar />
    </ThreadPrimitive.Root>
  );
};

/** One message in the thread: a day header when the day changes, then the message or its edit composer. */
const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);
  const id = useAuiState((s) => s.message.id);
  const previousId = useAuiState((s) => {
    const messages = s.thread.messages;
    const index = messages.findIndex((message) => message.id === s.message.id);
    return index > 0 ? messages[index - 1]?.id : undefined;
  });

  const times = useContext(MessageTimesContext);
  const day = dayOf(times.get(id) ?? new Date());
  const previousDay = previousId ? dayOf(times.get(previousId) ?? new Date()) : undefined;

  const body = isEditing ? (
    role === "user" ? (
      <UserEditMessage />
    ) : (
      <Composer autoFocus />
    )
  ) : role === "user" ? (
    <UserMessage />
  ) : (
    <AssistantMessage />
  );

  return (
    <div className="flex flex-col gap-2">
      {day !== previousDay && <DayHeader day={day} />}
      {body}
    </div>
  );
};

const ThreadScrollToBottom: FC = () => (
  <AuiIf condition={(s) => s.thread.messages.length > 0}>
    <ThreadPrimitive.ScrollToBottom asChild>
      <button
        type="button"
        aria-label="Scroll to bottom"
        className={cn(
          ghostButton,
          "bg-background absolute -top-10 left-1/2 size-8 -translate-x-1/2 border shadow-sm disabled:hidden",
        )}
      >
        <ArrowDownIcon className="size-4" />
      </button>
    </ThreadPrimitive.ScrollToBottom>
  </AuiIf>
);
