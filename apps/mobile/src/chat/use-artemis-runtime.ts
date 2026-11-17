import { useMemo } from "react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import type { UIMessage } from "ai";
import { authorizedStreamFetch } from "@/lib/api";
import { usePreferences } from "@/preferences";
import { useAuth } from "@/auth";
import { conversationsKey, messagesKey } from "@/queries/conversations";
import { useQueryClient } from "@tanstack/react-query";
import { CONVERSATION_TITLE_PART, type ConversationTitleData } from "./title-part";
import { createAttachmentAdapter } from "./attachment-adapter";
import { createConversationResumableStorage } from "./resumable-storage";
import { NativeChatTransport } from "./native-transport";

export interface ArtemisRuntimeOptions {
  conversationId: string;
  initialMessages: UIMessage[];
  /** A new chat only gets its id stored once the first reply finishes, so the list is refreshed then. */
  isNewConversation: boolean;
  /** The turn running in this conversation when it opened, if any: the app joins it. */
  activeStreamId?: string | null;
  /** The conversation's name, as soon as the naming model answers on the turn's stream. */
  onTitle?: (title: string) => void;
}

/**
 * The chat runtime for one conversation: the same AI SDK transport and body as the web app
 * (POST /api/chat with the conversation id, the messages and the reasoning effort), on the native fetch.
 * Switching conversations drops this runtime only: the turn keeps running on the server and is joined again
 * when its conversation is opened.
 */
export function useArtemisRuntime({ conversationId, initialMessages, isNewConversation, activeStreamId = null, onTitle }: ArtemisRuntimeOptions) {
  const queryClient = useQueryClient();
  const { preferences } = usePreferences();
  // Chat screens only mount once the user is signed in, so the server address is known here.
  const { state } = useAuth();
  const base = state.status === "signedIn" ? state.serverUrl : "";
  const effort = preferences.reasoningEffort;

  // Built once per conversation: a later refresh must not reset the storage of a turn in progress.
  const resumable = useMemo(() => createConversationResumableStorage(activeStreamId), [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // NativeChatTransport, not the library's resumable option: that option cannot read a stream on React Native.
  const transport = useMemo(
    () =>
      new NativeChatTransport({
        api: `${base}/api/chat`,
        fetch: authorizedStreamFetch,
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => ({
          body: { id: conversationId, messages, trigger, messageId, config: { reasoningEffort: effort } },
        }),
        resumable: {
          storage: resumable,
          resumeApi: (streamId: string) => `${base}/api/chat/resume/${streamId}`,
        },
      }),
    [base, conversationId, effort, resumable],
  );

  const attachments = useMemo(() => createAttachmentAdapter(conversationId), [conversationId]);

  return useChatRuntime({
    id: conversationId,
    messages: initialMessages,
    transport,
    adapters: { attachments },
    canResume: true,
    onData: (part) => {
      // The naming model answers on the same stream: the title shows up in the drawer as soon as it arrives.
      if (part.type !== CONVERSATION_TITLE_PART) return;
      const data = part.data as Partial<ConversationTitleData> | undefined;
      if (typeof data?.title === "string") {
        onTitle?.(data.title);
        queryClient.setQueryData<{ conversations: { id: string; title: string; updatedAt: string }[] }>(conversationsKey, (old) =>
          old
            ? { conversations: old.conversations.map((c) => (c.id === conversationId ? { ...c, title: data.title as string } : c)) }
            : old,
        );
      }
    },
    onFinish: () => {
      // The turn is over: nothing to reconnect to. A later open reads the server's state instead.
      resumable.clear();
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
      if (isNewConversation) void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
    },
  });
}
