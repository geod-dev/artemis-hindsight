import { AssistantRuntimeProvider } from "@assistant-ui/react-native";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { paletteHex } from "@/lib/avatar";
import { ConversationIdProvider } from "./conversation-context";
import { useArtemisRuntime } from "./use-artemis-runtime";
import { ThreadView } from "./thread-view";

export interface ChatScreenProps {
  conversationId: string;
  initialMessages: UIMessage[];
  isNewConversation: boolean;
  /** The turn running in this conversation when it opened, if any: the screen joins it. */
  activeStreamId?: string | null;
  /** The conversation's name, when the naming model answers on the turn's stream. */
  onTitle?: (title: string) => void;
  /** The project of a new chat (already checked against the user's projects), or null. */
  projectId?: string | null;
  /** The project's palette color: the mascot of the empty chat takes it. */
  projectColor?: string | null;
  /** The project picker of a new chat. Shown in the empty chat only, under the mascot and above the composer. */
  projectPicker?: ReactNode;
}

/** One chat session bound to a conversation id: the runtime, then the thread (messages and composer). */
export function ChatScreen({
  conversationId,
  initialMessages,
  isNewConversation,
  activeStreamId,
  onTitle,
  projectId = null,
  projectColor = null,
  projectPicker,
}: ChatScreenProps) {
  const runtime = useArtemisRuntime({ conversationId, initialMessages, isNewConversation, activeStreamId, onTitle, projectId });
  return (
    <ConversationIdProvider value={conversationId}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadView
          conversationId={conversationId}
          projectId={projectId}
          mascotTint={projectColor ? paletteHex(projectColor) : undefined}
          projectPicker={projectPicker}
        />
      </AssistantRuntimeProvider>
    </ConversationIdProvider>
  );
}
