import { useSyncExternalStore } from "react";

// Whether a push-to-talk press is held right now (a long press on the dictate button). The drawer reads it to turn its
// swipe off for the length of the press, so a sideways slide towards cancel or send does not open the conversation list.
// A single tap (push-to-toggle) does not set it: the drawer swipe keeps working while dictation runs.

let held = false;
const listeners = new Set<() => void>();

export function setPushToTalkHeld(next: boolean): void {
  if (held === next) return;
  held = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePushToTalkHeld(): boolean {
  return useSyncExternalStore(subscribe, () => held);
}
