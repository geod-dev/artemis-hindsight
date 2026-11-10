"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, createResumableSessionStorage, useChatRuntime } from "@assistant-ui/ai-sdk";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { createAttachmentAdapter } from "./attachment-adapter";
import { ConversationIdContext } from "./conversation-context";
import { MessageTimesContext } from "./day-header";
import { Thread } from "./thread";

const resumableStorage = createResumableSessionStorage();

export interface ChatSessionProps {
  conversationId: string;
  /** Messages already stored for this conversation. Empty for a new chat. */
  initialMessages: UIMessage[];
  /** True on the new-chat page, where the id is only stored once the first reply finishes. */
  isNewConversation: boolean;
}

/** Stored messages carry their creation time in `metadata.createdAt` (ISO string), set by the conversation page. */
function messageTimesOf(messages: UIMessage[]): ReadonlyMap<string, Date> {
  const entries: [string, Date][] = [];
  for (const message of messages) {
    const createdAt = (message.metadata as { createdAt?: string } | undefined)?.createdAt;
    if (createdAt) entries.push([message.id, new Date(createdAt)]);
  }
  return new Map(entries);
}

/**
 * One chat session bound to a conversation id. The id is the AI SDK chat id, so the server
 * receives it with every request and stores the conversation under it.
 */
export function ChatSession({ conversationId, initialMessages, isNewConversation }: ChatSessionProps) {
  const router = useRouter();

  // The body id must be our conversation UUID. assistant-ui may otherwise send its own thread id.
  // The turn runs on the server: the browser keeps the stream id of the running turn (in session storage)
  // and, after a reload, reconnects to it through /api/chat/resume/<streamId>.
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => ({
          body: { id: conversationId, messages, trigger, messageId },
        }),
        resumable: {
          storage: resumableStorage,
          resumeApi: (streamId: string) => `/api/chat/resume/${streamId}`,
        },
      }),
    [conversationId],
  );

  const attachments = useMemo(() => createAttachmentAdapter(conversationId), [conversationId]);

  const runtime = useChatRuntime({
    id: conversationId,
    messages: initialMessages,
    transport,
    adapters: { attachments },
    canResume: true,
    onFinish: () => {
      if (isNewConversation && window.location.pathname !== `/c/${conversationId}`) {
        // Keep the live runtime: changing the URL without navigating preserves the stream state.
        window.history.replaceState(null, "", `/c/${conversationId}`);
      }
      router.refresh(); // updates the sidebar list and ordering
    },
  });

  const times = useMemo(() => messageTimesOf(initialMessages), [initialMessages]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ConversationIdContext.Provider value={conversationId}>
        <MessageTimesContext.Provider value={times}>
          <div className="h-full min-h-0">
            <Thread />
          </div>
        </MessageTimesContext.Provider>
      </ConversationIdContext.Provider>
    </AssistantRuntimeProvider>
  );
}
