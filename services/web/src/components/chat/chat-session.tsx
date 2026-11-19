"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, createResumableSessionStorage, useChatRuntime } from "@assistant-ui/ai-sdk";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useConversationTitles } from "@/components/conversation-titles";
import { ProjectPicker } from "@/components/projects/project-picker";
import { ProjectRecents } from "@/components/projects/project-recents";
import { paletteColorCss } from "@/lib/avatar-colors";
import { CONVERSATION_TITLE_PART, type ConversationTitleData } from "@/lib/conversation-title-part";
import type { ProjectRef, ProjectSummary } from "@/lib/projects";
import type { TemporaryMode } from "@/lib/temporary-chat";
import { ChatPageFrame } from "./chat-page-frame";
import { createAttachmentAdapter } from "./attachment-adapter";
import { ConversationHeading } from "./conversation-heading";
import { ConversationIdContext, ProjectColorContext } from "./conversation-context";
import { MessageTimesContext } from "./day-header";
import { dictationAdapter } from "./server-dictation-adapter";
import {
  TemporaryChatControls,
  TemporaryChatHeading,
  TemporaryChatKeepAlive,
  TemporaryChatNotice,
} from "./temporary-chat";
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
  /** The new chat's projects, for its project picker. Only used on the new-chat page. */
  projects?: ProjectSummary[];
  /** The project selected in the picker, or null for none. Sent with the first message, which creates the conversation. */
  projectId?: string | null;
  onProjectChange?: (projectId: string | null) => void;
  /** The conversation's project, shown as a badge after its name in the top bar. Null outside any project. */
  project?: ProjectRef | null;
  /**
   * Set for a temporary chat: its mode. On the new-chat page, the mode the temporary switch selected, sent with the first
   * message, which creates the conversation. Null for a normal chat.
   */
  temporary?: TemporaryMode | null;
  /** The new chat's temporary switch. Only used on the new-chat page. */
  onTemporaryChange?: (mode: TemporaryMode | null) => void;
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
  projects = [],
  projectId = null,
  onProjectChange = () => undefined,
  project = null,
  temporary = null,
  onTemporaryChange = () => undefined,
}: ChatSessionProps) {
  const router = useRouter();
  const { setTitle } = useConversationTitles();

  // The transport is built once per conversation, so the selected project and temporary mode reach it through refs.
  const projectRef = useRef(projectId);
  const temporaryRef = useRef(temporary);
  useEffect(() => {
    projectRef.current = projectId;
    temporaryRef.current = temporary;
  }, [projectId, temporary]);

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
          // projectId and temporary only matter to the message that creates the conversation; the server ignores them
          // otherwise.
          body: {
            id: conversationId,
            messages,
            trigger,
            messageId,
            config: body?.config,
            projectId: projectRef.current,
            temporary: temporaryRef.current,
          },
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

  // Only the new chat has a project. Its picker sits under the mascot; with a project selected, the mascot takes the
  // project's color and its recent conversations show under the composer.
  const selectedProject = isNewConversation ? (projects.find((project) => project.id === projectId) ?? null) : null;
  // The mascot takes the chat's project color, in the empty state and beside each reply.
  const chatProject = isNewConversation ? selectedProject : project;
  const mascotColor = chatProject ? paletteColorCss(chatProject.color) : undefined;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ConversationIdContext.Provider value={conversationId}>
        <ProjectColorContext.Provider value={mascotColor}>
          <MessageTimesContext.Provider value={times}>
            {temporary && <TemporaryChatKeepAlive conversationId={conversationId} />}
            <ChatPageFrame
              title={
                temporary ? (
                  <TemporaryChatHeading mode={temporary} />
                ) : (
                  <ConversationHeading
                    conversationId={conversationId}
                    initialTitle={initialTitle}
                    project={isNewConversation ? selectedProject : project}
                  />
                )
              }
              actions={
                isNewConversation ? <TemporaryChatControls value={temporary} onChange={onTemporaryChange} /> : undefined
              }
            >
              <div className="h-full min-h-0">
                <Thread
                  mascotColor={mascotColor}
                  underMascot={
                    !isNewConversation ? undefined : temporary ? (
                      <TemporaryChatNotice mode={temporary} />
                    ) : (
                      <ProjectPicker projects={projects} value={projectId} onChange={onProjectChange} />
                    )
                  }
                  belowComposer={
                    selectedProject ? <ProjectRecents key={selectedProject.id} projectId={selectedProject.id} /> : undefined
                  }
                />
              </div>
            </ChatPageFrame>
          </MessageTimesContext.Provider>
        </ProjectColorContext.Provider>
      </ConversationIdContext.Provider>
    </AssistantRuntimeProvider>
  );
}
