import { MessageByIndexProvider, useAuiState } from "@assistant-ui/react-native";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

/**
 * The message being edited on the phone, or null. Editing happens in the composer: while a message is edited, the composer
 * is given that message's scope, so it reads and writes the message's edit composer (its text and files). The thread's own
 * composer keeps the draft that was there, and shows it again when the edit is sent or dropped.
 */
export interface Editing {
  messageId: string | null;
  start: (messageId: string) => void;
  stop: () => void;
}

export const EditingContext = createContext<Editing>({ messageId: null, start: () => undefined, stop: () => undefined });

export function useEditing(): Editing {
  return useContext(EditingContext);
}

/**
 * Puts its children (the composer) in the scope of the message being edited, when there is one and it is shown. The edit
 * ends when the message's edit composer closes (sent, dropped) or when the message leaves the thread (another branch).
 */
export function EditingScope({ children }: { children: ReactNode }) {
  const { messageId, stop } = useEditing();
  const index = useAuiState((s) => (messageId ? s.thread.messages.findIndex((message) => message.id === messageId) : -1));

  useEffect(() => {
    if (messageId && index === -1) stop();
  }, [messageId, index, stop]);

  if (!messageId || index === -1) return <>{children}</>;
  return (
    <MessageByIndexProvider index={index}>
      <EditEndWatcher onEnd={stop} />
      {children}
    </MessageByIndexProvider>
  );
}

/** Calls `onEnd` once the message's edit composer, open when the watcher mounts, closes. */
function EditEndWatcher({ onEnd }: { onEnd: () => void }) {
  const isEditing = useAuiState((s) => s.composer.isEditing);
  const wasEditing = useRef(isEditing);
  useEffect(() => {
    if (wasEditing.current && !isEditing) onEnd();
    wasEditing.current = isEditing;
  }, [isEditing, onEnd]);
  return null;
}
