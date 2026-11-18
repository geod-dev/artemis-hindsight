import { useSyncExternalStore } from "react";

// The project the new chat screen has selected now, or null. The new chat writes it (its picker chooses the project);
// the drawer reads it to highlight that project in its Projects list, as the web's sidebar does.

let current: string | null = null;
const subscribers = new Set<() => void>();

/** Records the project the new chat has selected now (null for none). Called by the new chat screen. */
export function setNewChatProjectSelection(projectId: string | null): void {
  if (current === projectId) return;
  current = projectId;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

/** The project the new chat has selected now, or null. Updates as the picker changes it. */
export function useNewChatProjectSelection(): string | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
