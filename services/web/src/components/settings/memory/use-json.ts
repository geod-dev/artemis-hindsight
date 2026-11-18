"use client";

import { useEffect, useState } from "react";

export type JsonState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

/**
 * Reads a JSON route of the web app. Loads again when `url` or `version` changes; a newer load replaces an older one.
 * Null `url` reads nothing.
 */
export function useJson<T>(url: string | null, version = 0): JsonState<T> {
  const [state, setState] = useState<JsonState<T>>({ status: "loading" });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : "";
          throw new Error(message || `HTTP ${res.status}`);
        }
        setState({ status: "ready", data: body as T });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [url, version]);

  return state;
}
