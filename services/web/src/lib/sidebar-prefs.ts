// The sidebar's view preferences. They live in this browser only: a convenience, not data the server needs.

const SHOW_PROJECT_CONVERSATIONS = "artemis.sidebar.showProjectConversations";

/** Whether Recents lists the conversations that belong to a project. On by default. */
export function readShowProjectConversations(): boolean {
  try {
    return window.localStorage.getItem(SHOW_PROJECT_CONVERSATIONS) !== "false";
  } catch {
    // Storage can be blocked (private windows, disabled site data): the default applies.
    return true;
  }
}

export function writeShowProjectConversations(show: boolean): void {
  try {
    window.localStorage.setItem(SHOW_PROJECT_CONVERSATIONS, String(show));
  } catch {
    // Not stored: the choice lasts until the page is reloaded.
  }
}
