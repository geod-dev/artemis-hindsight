// The project selected on the new chat page. The sidebar picks a project (or "no project") with a link and with this
// event, so a click works even when the URL already names that project: the new chat page listens to the event.

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
