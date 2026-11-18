// Live updates of the user's lists (conversations and projects). A write that changes what those lists show announces it
// here, from the repository that made the write. Every open connection of that user, in any window or on any device,
// then gets a `changed` event on /api/events and reads the lists again.
//
// The subscriptions live in memory, like the turn registry: they serve this server process. A restart drops the
// connections; the apps reconnect, and read the lists again when they do.

type Listener = () => void;

const state = globalThis as typeof globalThis & { __artemisListListeners?: Map<string, Set<Listener>> };

function listenersByUser(): Map<string, Set<Listener>> {
  state.__artemisListListeners ??= new Map();
  return state.__artemisListListeners;
}

/** Calls `listener` whenever one of the user's lists changes. Returns the unsubscribe. */
export function subscribeToListChanges(userId: string, listener: Listener): () => void {
  const byUser = listenersByUser();
  const listeners = byUser.get(userId) ?? new Set<Listener>();
  listeners.add(listener);
  byUser.set(userId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && byUser.get(userId) === listeners) byUser.delete(userId);
  };
}

/** Tells the user's open connections that a list changed. Called by the repositories after their write. */
export function announceListChange(userId: string): void {
  const listeners = listenersByUser().get(userId);
  if (!listeners) return;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.error("list change listener failed", error);
    }
  }
}
