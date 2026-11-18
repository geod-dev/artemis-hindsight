import { useSyncExternalStore } from "react";

// The project selected on the new chat page. The sidebar picks a project (or "no project") with a link and with this
// event, so a click works even when the URL already names that project: the new chat page listens to the event.
// The page also keeps the current selection here, so the sidebar highlights the project the picker chose.

const EVENT = "artemis:new-chat-project";

/** Selects a project on the new chat page, or none (null). */
export function selectNewChatProject(projectId: string | null): void {
  window.dispatchEvent(new CustomEvent<string | null>(EVENT, { detail: projectId }));
}

/** Calls `listener` whenever a project is selected from outside the new chat's own picker. Returns the unsubscribe. */
export function onNewChatProjectSelected(listener: (projectId: string | null) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<string | null>).detail);
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}

// The project the new chat page has selected now, or null. Written by the new chat page; read by the sidebar.
let current: string | null = null;
const subscribers = new Set<() => void>();

/** Records the project the new chat page has selected now (null for none). Called by the new chat page. */
export function setNewChatProjectSelection(projectId: string | null): void {
  if (current === projectId) return;
  current = projectId;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

/** The project the new chat page has selected now, or null. Updates as the picker or the sidebar change it. */
export function useNewChatProjectSelection(): string | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
