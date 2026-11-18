// The lists of the web app (the projects and the conversations) changed: in this window, or elsewhere (another window or
// the phone). LiveUpdates announces every change it receives from /api/events; components that show a list listen here.

const EVENT = "artemis:lists-changed";

/** Calls `listener` whenever one of the lists changed. Returns the unsubscribe. */
export function onListsChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Tells this window's listeners that a list changed. */
export function dispatchListsChanged(): void {
  window.dispatchEvent(new Event(EVENT));
}
