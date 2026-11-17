import { useLocalSearchParams, useNavigation } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useLayoutEffect, useState } from "react";
import { ChatScreen } from "@/chat/chat-screen";

/**
 * A new conversation. The screen stays on this route for the whole chat: replacing the route with /c/<id> after the first
 * reply would mount a new screen that loads the conversation again (a spinner, then the chat remounts), so the header takes
 * the name when it arrives instead. The `session` parameter changes each time "New conversation" is pressed, which gives a
 * fresh chat even when this route is already open.
 */
export default function NewChatScreen() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  return <NewChat key={session ?? "initial"} />;
}

function NewChat() {
  const [conversationId] = useState(() => randomUUID());
  const [title, setTitle] = useState("New conversation");
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return <ChatScreen conversationId={conversationId} initialMessages={[]} isNewConversation onTitle={setTitle} />;
}
