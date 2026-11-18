"use client";

import { useStoredState } from "./use-stored-state";

// The developer settings. They live in this browser only, like the sidebar preferences: a convenience for whoever
// works on Artemis, not data the server needs.

const SHOW_MESSAGE_DEBUG = "artemis.dev.showMessageDebug";

const isBoolean = (raw: unknown) => (typeof raw === "boolean" ? raw : undefined);

/** Whether messages show their debug menu, and its setter. Off by default. */
export function useMessageDebugPreference(): [boolean, (show: boolean) => void] {
  return useStoredState(SHOW_MESSAGE_DEBUG, false, isBoolean);
}

/** Whether messages show their debug menu. Every open message updates when the setting changes. */
export function useShowMessageDebug(): boolean {
  return useMessageDebugPreference()[0];
}
