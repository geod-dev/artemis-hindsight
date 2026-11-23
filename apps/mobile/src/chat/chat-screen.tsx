import { AssistantRuntimeProvider } from "@assistant-ui/react-native";
import type { ReactNode } from "react";
import { paletteHex } from "@/lib/avatar";
import type { TemporaryMode } from "@/lib/temporary-chat";
import { ConversationIdProvider } from "./conversation-context";
import { ContinuedRepliesProvider } from "./continued-replies";
import type { MessageTree } from "./message-tree";
import { TemporaryChatKeepAlive, ThreadStartWatcher } from "./temporary-chat";
import { useArtemisRuntime } from "./use-artemis-runtime";
import { ThreadView } from "./thread-view";

export interface ChatScreenProps {
  conversationId: string;
  /** The stored messages, every branch, and the branch the conversation opens on. Empty for a new chat. */
  initialTree?: MessageTree;
  isNewConversation: boolean;
  /** The turn running in this conversation when it opened, if any: the screen joins it. */
  activeStreamId?: string | null;
  /** The conversation's name, when the naming model answers on the turn's stream. */
  onTitle?: (title: string) => void;
  /** The project of a new chat (already checked against the user's projects), or null. */
  projectId?: string | null;
  /** The project's palette color: the mascot of the empty chat takes it. */
  projectColor?: string | null;
  /**
   * What the empty chat shows under the mascot, above the composer: the new chat's project picker, or the temporary chat's
   * notice.
   */
  projectPicker?: ReactNode;
  /** The temporary mode of the chat, or null for a normal chat. A temporary chat is kept alive while it is shown. */
  temporary?: TemporaryMode | null;
  /** Called once the chat has its first message. */
  onStarted?: () => void;
}

/** One chat session bound to a conversation id: the runtime, then the thread (messages and composer). */
export function ChatScreen({
  conversationId,
  initialTree,
  isNewConversation,
  activeStreamId,
  onTitle,
  projectId = null,
  projectColor = null,
  projectPicker,
  temporary = null,
  onStarted,
}: ChatScreenProps) {
  const runtime = useArtemisRuntime({
    conversationId,
    initialTree,
    isNewConversation,
    activeStreamId,
    onTitle,
    projectId,
    temporary,
  });
  return (
    <ConversationIdProvider value={conversationId}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ContinuedRepliesProvider>
        {temporary ? <TemporaryChatKeepAlive conversationId={conversationId} /> : null}
        {onStarted ? <ThreadStartWatcher onStarted={onStarted} /> : null}
        <ThreadView
          conversationId={conversationId}
          projectId={projectId}
          mascotTint={projectColor ? paletteHex(projectColor) : undefined}
          projectPicker={projectPicker}
        />
        </ContinuedRepliesProvider>
      </AssistantRuntimeProvider>
    </ConversationIdProvider>
  );
}
