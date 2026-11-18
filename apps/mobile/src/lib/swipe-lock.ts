import { useSyncExternalStore } from "react";

// The sideways swipe of the drawer. Anything that takes a sideways drag for itself (a gallery's scroll, a dictate press)
// holds the lock while it has the finger; the drawer's swipe is off while the lock is held. Holders are counted, so several
// can hold it at once, and the swipe is back when the last one lets go.

let holders = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Takes the lock. The returned function gives it back; calling it again does nothing. */
export function acquireSwipeLock(): () => void {
  holders += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    notify();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether something on screen holds the sideways swipe right now. */
export function useSwipeLocked(): boolean {
  return useSyncExternalStore(subscribe, () => holders > 0);
}
