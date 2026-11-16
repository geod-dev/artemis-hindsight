import { useNavigation } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useLayoutEffect, useState } from "react";
import { ChatScreen } from "@/chat/chat-screen";

/**
 * A new conversation: its id is made here and the screen stays on this route for the whole chat. Replacing the route
 * with /c/<id> after the first reply would mount a new screen that loads the conversation again (a spinner, then the
 * chat remounts), so the header takes the name when it arrives instead. The conversation is opened by /c/<id> from
 * the list from then on.
 */
export default function NewChatScreen() {
  const [conversationId] = useState(() => randomUUID());
  const [title, setTitle] = useState("New conversation");
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return <ChatScreen conversationId={conversationId} initialMessages={[]} isNewConversation onTitle={setTitle} />;
}
