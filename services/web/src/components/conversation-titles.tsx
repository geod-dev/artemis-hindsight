"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ConversationTitles {
  /** Names received in this browser session, by conversation id. They win over the titles the server rendered. */
  renamed: Readonly<Record<string, string>>;
  setTitle: (conversationId: string, title: string) => void;
}

const ConversationTitlesContext = createContext<ConversationTitles | null>(null);

/**
 * Keeps a conversation's new name while the user moves between chats, so the sidebar shows it before the server's
 * list is refreshed. Wraps the whole signed-in shell, so the sidebar and the chat share one state.
 */
export function ConversationTitlesProvider({ children }: { children: ReactNode }) {
  const [renamed, setRenamed] = useState<Record<string, string>>({});

  const setTitle = useCallback((conversationId: string, title: string) => {
    setRenamed((current) => (current[conversationId] === title ? current : { ...current, [conversationId]: title }));
  }, []);

  const value = useMemo(() => ({ renamed, setTitle }), [renamed, setTitle]);
  return <ConversationTitlesContext.Provider value={value}>{children}</ConversationTitlesContext.Provider>;
}

export function useConversationTitles(): ConversationTitles {
  const value = useContext(ConversationTitlesContext);
  if (!value) throw new Error("useConversationTitles must be used inside ConversationTitlesProvider");
  return value;
}
