import { createContext, useContext, type ReactNode } from "react";

const ConversationIdContext = createContext<string | null>(null);

/** The conversation the messages belong to: sandbox files are fetched per conversation. */
export function ConversationIdProvider({ value, children }: { value: string; children: ReactNode }) {
  return <ConversationIdContext.Provider value={value}>{children}</ConversationIdContext.Provider>;
}

export function useConversationId(): string {
  const value = useContext(ConversationIdContext);
  if (!value) throw new Error("useConversationId must be used inside ConversationIdProvider");
  return value;
}
