"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// A preference kept in this browser's localStorage: a convenience, not data the server needs. Every component reading
// the same key updates when it changes, in this tab and in the others. The server render and the first client render
// use the fallback, so hydration matches; the stored value applies right after.

/** Sent in this tab when a stored value changes; other tabs get the browser's own "storage" event. */
const CHANGE_EVENT = "artemis:stored-state";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Values that could not be stored (blocked storage, full quota): they hold until the page is reloaded. */
const unstored = new Map<string, string>();

function read(key: string): string | null {
  if (unstored.has(key)) return unstored.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be blocked (private windows, disabled site data): the fallback applies.
    return null;
  }
}

function write(key: string, raw: string): void {
  try {
    window.localStorage.setItem(key, raw);
    unstored.delete(key);
  } catch {
    unstored.set(key, raw);
  }
}

/**
 * The value stored under `key`, or `fallback` when there is none or `parse` rejects it (returns undefined).
 * The setter stores the value as JSON.
 */
export function useStoredState<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | undefined,
): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );

  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      return parse(JSON.parse(raw)) ?? fallback;
    } catch {
      return fallback;
    }
    // `fallback` and `parse` are fixed per call site; only the stored text decides the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = useCallback(
    (next: T) => {
      write(key, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return [value, setValue];
}

/** A parser for `useStoredState`: one of `allowed`. */
export function oneOf<T extends string>(allowed: readonly T[]) {
  return (raw: unknown): T | undefined => (allowed.includes(raw as T) ? (raw as T) : undefined);
}

/** A parser for `useStoredState`: a list of distinct values of `allowed`, in the order of `allowed`. */
export function someOf<T extends string>(allowed: readonly T[]) {
  return (raw: unknown): T[] | undefined =>
    Array.isArray(raw) ? allowed.filter((value) => raw.includes(value)) : undefined;
}
