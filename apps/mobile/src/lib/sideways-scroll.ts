import { useSyncExternalStore } from "react";
import type { GestureType } from "react-native-gesture-handler";

// The sideways scrolls on screen (a gallery's row). The drawer's pan waits for each of them to fail (see app/(drawer)/_layout.tsx),
// natively: a drag that a scroll takes never opens the drawer.

let scrolls: GestureType[] = [];
const listeners = new Set<() => void>();

function publish(next: GestureType[]): void {
  scrolls = next;
  for (const listener of listeners) listener();
}

/** Registers a sideways scroll. The returned function removes it again. */
export function registerSidewaysScroll(scroll: GestureType): () => void {
  publish([...scrolls, scroll]);
  return () => publish(scrolls.filter((registered) => registered !== scroll));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Makes a pan wait for the sideways scrolls to fail. The drawer hands its pan over typed with the gesture library's newer API,
 * but the pan it builds is the legacy one, which has these relations: the cast only states that.
 */
export function awaitSidewaysScrolls<Pan>(pan: Pan, scrolls: GestureType[]): Pan {
  if (scrolls.length === 0) return pan;
  const legacy = pan as unknown as GestureType;
  return legacy.requireExternalGestureToFail(...scrolls) as unknown as Pan;
}

/** The sideways scrolls on screen right now. */
export function useSidewaysScrolls(): GestureType[] {
  return useSyncExternalStore(subscribe, () => scrolls);
}
