import { AssistantRuntimeProvider } from "@assistant-ui/react-native";
import type { UIMessage } from "ai";
import { ConversationIdProvider } from "./conversation-context";
import { useArtemisRuntime } from "./use-artemis-runtime";
import { ThreadView } from "./thread-view";

export interface ChatScreenProps {
  conversationId: string;
  initialMessages: UIMessage[];
  isNewConversation: boolean;
  /** The turn running in this conversation when it opened, if any: the screen joins it. */
  activeStreamId?: string | null;
  /** Called after a turn finishes: a new chat uses it to take its permanent route. */
  onTurnFinished?: () => void;
  /** The conversation's name, when the naming model answers on the turn's stream. */
  onTitle?: (title: string) => void;
}

/** One chat session bound to a conversation id: the runtime, then the thread (messages and composer). */
export function ChatScreen({ conversationId, initialMessages, isNewConversation, activeStreamId, onTurnFinished, onTitle }: ChatScreenProps) {
  const runtime = useArtemisRuntime({
    conversationId,
    initialMessages,
    isNewConversation,
    activeStreamId,
    onFinished: onTurnFinished,
    onTitle,
  });
  return (
    <ConversationIdProvider value={conversationId}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadView conversationId={conversationId} />
      </AssistantRuntimeProvider>
    </ConversationIdProvider>
  );
}
