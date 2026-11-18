import { useSyncExternalStore } from "react";

// What the new chat screen is showing, for the drawer: the project it has selected, and the conversation it is writing (its id
// is not in the route, and the route stays /new after the first message). The drawer highlights the project and the
// conversation. Both are null when no new chat is on screen.

let project: string | null = null;
let conversation: string | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/** Records the project the new chat has selected now (null for none). Called by the new chat screen. */
export function setNewChatProjectSelection(projectId: string | null): void {
  if (project === projectId) return;
  project = projectId;
  notify();
}

/** Records the conversation the new chat is writing (null when the new chat leaves the screen). */
export function setNewChatConversation(conversationId: string | null): void {
  if (conversation === conversationId) return;
  conversation = conversationId;
  notify();
}

/** The project the new chat has selected now, or null. Updates as the picker changes it. */
export function useNewChatProjectSelection(): string | null {
  return useSyncExternalStore(subscribe, () => project, () => null);
}

/** The conversation the new chat is writing now, or null. */
export function useNewChatConversation(): string | null {
  return useSyncExternalStore(subscribe, () => conversation, () => null);
}
