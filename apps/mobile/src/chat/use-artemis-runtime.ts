import { useEffect, useMemo, useRef } from "react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { apiFetch, authorizedStreamFetch } from "@/lib/api";
import type { TemporaryMode } from "@/lib/temporary-chat";
import { usePreferences } from "@/preferences";
import { useAuth } from "@/auth";
import { conversationsKey, messagesKey, projectConversationsKey } from "@/queries/conversations";
import { useQueryClient } from "@tanstack/react-query";
import { CONVERSATION_TITLE_PART, type ConversationTitleData } from "./title-part";
import { createAttachmentAdapter } from "./attachment-adapter";
import { createConversationResumableStorage } from "./resumable-storage";
import type { MessageTree } from "./message-tree";
import { NativeChatTransport } from "./native-transport";
import { useBranchSaving, useRestoreBranches } from "./use-branch-memory";

export interface ArtemisRuntimeOptions {
  conversationId: string;
  /** The stored messages, every branch, and the branch the conversation opens on. Empty for a new chat. */
  initialTree?: MessageTree;
  /** A new chat only gets its id stored once the first reply finishes, so the list is refreshed then. */
  isNewConversation: boolean;
  /** The turn running in this conversation when it opened, if any: the app joins it. */
  activeStreamId?: string | null;
  /** The conversation's name, as soon as the naming model answers on the turn's stream. */
  onTitle?: (title: string) => void;
  /** The project selected in a new chat, or null. Sent with the first message, which creates the conversation. */
  projectId?: string | null;
  /** The temporary mode of the chat, or null for a normal chat. Sent with the first message, which creates the conversation. */
  temporary?: TemporaryMode | null;
}

/**
 * The chat runtime for one conversation: the same AI SDK transport and body as the web app
 * (POST /api/chat with the conversation id, the messages and the reasoning effort), on the native fetch.
 * Switching conversations drops this runtime only: the turn keeps running on the server and is joined again
 * when its conversation is opened.
 */
/** The stopped reply a run continues: the run config's `custom.continueMessageId`, which reaches the request as its metadata. */
function continueMessageIdOf(requestMetadata: unknown): string | undefined {
  const value = (requestMetadata as { custom?: { continueMessageId?: unknown } } | undefined)?.custom?.continueMessageId;
  return typeof value === "string" ? value : undefined;
}

const EMPTY_TREE: MessageTree = { headId: null, messages: [] };

export function useArtemisRuntime({
  conversationId,
  initialTree = EMPTY_TREE,
  isNewConversation,
  activeStreamId = null,
  onTitle,
  projectId = null,
  temporary = null,
}: ArtemisRuntimeOptions) {
  const queryClient = useQueryClient();
  const { preferences } = usePreferences();
  // Chat screens only mount once the user is signed in, so the server address is known here.
  const { state } = useAuth();
  const base = state.status === "signedIn" ? state.serverUrl : "";
  const effort = preferences.reasoningEffort;

  // The transport is built once per conversation, so the selected project and temporary mode reach it through refs (as on
  // the web).
  const projectRef = useRef(projectId);
  const temporaryRef = useRef(temporary);
  useEffect(() => {
    projectRef.current = projectId;
    temporaryRef.current = temporary;
  }, [projectId, temporary]);

  // Built once per conversation: a later refresh must not reset the storage of a turn in progress.
  const resumable = useMemo(() => createConversationResumableStorage(activeStreamId), [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // NativeChatTransport, not the library's resumable option: that option cannot read a stream on React Native.
  const transport = useMemo(
    () =>
      new NativeChatTransport({
        api: `${base}/api/chat`,
        fetch: authorizedStreamFetch,
        prepareSendMessagesRequest: ({ messages, trigger, messageId, requestMetadata }) => ({
          // The messages are the branch the message is sent on: the server stores the message after the one before it.
          // projectId and temporary only matter to the message that creates the conversation; the server ignores them
          // otherwise.
          body: {
            id: conversationId,
            messages,
            trigger,
            messageId,
            config: { reasoningEffort: effort },
            // Set by Continue under a stopped reply (message-view.tsx, StoppedRow): the reply to go on with.
            continueMessageId: continueMessageIdOf(requestMetadata),
            projectId: projectRef.current,
            temporary: temporaryRef.current,
          },
        }),
        resumable: {
          storage: resumable,
          resumeApi: (streamId: string) => `${base}/api/chat/resume/${streamId}`,
        },
      }),
    [base, conversationId, effort, resumable],
  );

  const attachments = useMemo(() => createAttachmentAdapter(conversationId), [conversationId]);

  // The branch the user switches to is stored on the server, so every device opens the conversation on it.
  const { onBranchChange, restoring } = useBranchSaving((leafId) => {
    void apiFetch(`/api/conversations/${conversationId}/branch`, { method: "POST", json: { leafId } }).catch(() => undefined);
  });

  const runtime = useChatRuntime({
    id: conversationId,
    // Every branch, opened on the one the user was on.
    messageRepository: initialTree,
    unstable_onBranchChange: onBranchChange,
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
      // A reply can create a conversation in a project, or move one to the top of its project's recents.
      void queryClient.invalidateQueries({ queryKey: projectConversationsKey });
      if (isNewConversation) void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
    },
  });
  useRestoreBranches(runtime, initialTree, restoring);
  return runtime;
}
