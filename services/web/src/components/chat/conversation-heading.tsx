"use client";

import { useConversationTitles } from "@/components/conversation-titles";
import { useTypedText } from "@/hooks/use-typed-text";

/** The conversation's name in the top bar. A name that arrives while the chat is open is typed out. */
export function ConversationHeading({ conversationId, initialTitle }: { conversationId: string; initialTitle: string }) {
  const { renamed } = useConversationTitles();
  const { text, typing } = useTypedText(renamed[conversationId] ?? initialTitle);

  return (
    <span className="block truncate">
      {text}
      {typing && (
        <span aria-hidden className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-current align-middle" />
      )}
    </span>
  );
}
