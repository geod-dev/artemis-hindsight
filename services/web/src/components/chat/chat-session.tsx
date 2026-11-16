"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, createResumableSessionStorage, useChatRuntime } from "@assistant-ui/ai-sdk";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useConversationTitles } from "@/components/conversation-titles";
import { CONVERSATION_TITLE_PART, type ConversationTitleData } from "@/lib/conversation-title-part";
import { ChatPageFrame } from "./chat-page-frame";
import { createAttachmentAdapter } from "./attachment-adapter";
import { ConversationHeading } from "./conversation-heading";
import { ConversationIdContext } from "./conversation-context";
import { MessageTimesContext } from "./day-header";
import { dictationAdapter } from "./server-dictation-adapter";
import { Thread } from "./thread";

export interface ChatSessionProps {
  conversationId: string;
  /** Messages already stored for this conversation. Empty for a new chat. */
  initialMessages: UIMessage[];
  /** True on the new-chat page, where the id is only stored once the first reply finishes. */
  isNewConversation: boolean;
  /** The stored name, shown in the top bar. Empty for a new chat until its name arrives. */
  initialTitle?: string;
  /** The turn running in this conversation when the page opened, if any: this page joins it instead of waiting. */
  activeStreamId?: string | null;
}

/**
 * The pending-turn storage of one conversation. Scoped per conversation so that switching conversations while a
 * reply runs never resumes that reply inside another conversation.
 */
function resumableStorageFor(conversationId: string, activeStreamId: string | null | undefined) {
  const storage = createResumableSessionStorage({ key: () => `artemis.stream.${conversationId}` });
  if (activeStreamId) storage.setStreamId(activeStreamId);
  return storage;
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
export function ChatSession({
  conversationId,
  initialMessages,
  isNewConversation,
  initialTitle = "",
  activeStreamId = null,
}: ChatSessionProps) {
  const router = useRouter();
  const { setTitle } = useConversationTitles();

  // The body id must be our conversation UUID. assistant-ui may otherwise send its own thread id.
  // The turn runs on the server: the browser keeps the stream id of the running turn and reconnects to it through
  // /api/chat/resume/<streamId>, after a reload or when this page joins a turn that is already running.
  const transport = useMemo(
    () => {
      const storage = resumableStorageFor(conversationId, activeStreamId);
      return new AssistantChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, trigger, messageId, body }) => ({
          // config holds the model context's settings, such as the reasoning effort chosen in the composer.
          body: { id: conversationId, messages, trigger, messageId, config: body?.config },
        }),
        resumable: {
          storage,
          resumeApi: (streamId: string) => `/api/chat/resume/${streamId}`,
        },
      });
    },
    // activeStreamId only matters when the page opens: a later value must not rebuild the transport mid-turn.
    [conversationId],
  );

  const attachments = useMemo(() => createAttachmentAdapter(conversationId), [conversationId]);

  const runtime = useChatRuntime({
    id: conversationId,
    messages: initialMessages,
    transport,
    adapters: { attachments, dictation: dictationAdapter },
    canResume: true,
    // The conversation's name arrives on the turn's stream once the naming model has answered.
    onData: (part) => {
      if (part.type !== CONVERSATION_TITLE_PART) return;
      const data = part.data as Partial<ConversationTitleData> | undefined;
      if (typeof data?.title === "string") setTitle(conversationId, data.title);
    },
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
          <ChatPageFrame title={<ConversationHeading conversationId={conversationId} initialTitle={initialTitle} />}>
            <div className="h-full min-h-0">
              <Thread />
            </div>
          </ChatPageFrame>
        </MessageTimesContext.Provider>
      </ConversationIdContext.Provider>
    </AssistantRuntimeProvider>
  );
}
