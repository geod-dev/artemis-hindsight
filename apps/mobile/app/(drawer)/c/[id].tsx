import { useLocalSearchParams, useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ChatScreen } from "@/chat/chat-screen";
import { ConversationTitleBar } from "@/components/conversation-title-bar";
import { useConversationMessages } from "@/queries/conversations";
import { usePreferences } from "@/preferences";

/** An existing conversation: its stored messages load first, then the chat opens on them. */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { colors } = usePreferences();
  const { data, isPending, isError } = useConversationMessages(id, Boolean(id));

  // The top bar shows the title with the project's badge after it, when the conversation has a project.
  useLayoutEffect(() => {
    if (!data) return;
    const { title, project } = data.conversation;
    navigation.setOptions({
      title,
      headerTitle: () => <ConversationTitleBar title={title} project={project} />,
    });
  }, [data, navigation]);

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background }}>
        <Text style={{ color: colors.muted }}>Conversation not found.</Text>
      </View>
    );
  }

  // Keyed by id: switching conversation, even while a reply runs, starts a fresh runtime with its own messages.
  // The reply that was running keeps running on the server; activeStreamId lets this screen join it.
  return (
    <ChatScreen
      key={id}
      conversationId={id}
      initialMessages={data.messages}
      isNewConversation={false}
      activeStreamId={data.activeStreamId}
    />
  );
}
