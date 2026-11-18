import { useQueryClient } from "@tanstack/react-query";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect } from "react";
import { AppState } from "react-native";
import { absoluteUrl, authHeaders } from "@/lib/api";
import { invalidateConversationLists } from "./conversations";
import { projectsKey } from "./projects";

// Mirrors services/web/src/app/api/events/route.ts. A `changed` event means one of the user's lists changed: on this
// phone, in the web app, or on another device. Nothing else is sent (the comment lines are heartbeats).
const RECONNECT_MS = 3_000;
// Several changes in a burst read the lists once.
const COALESCE_MS = 150;

/**
 * The signed-in user's live lists. While the app is in front, the server's event stream is open; a `changed` event reads
 * the conversation and project lists again. The stream reconnects by itself. Each connection, and each return to the
 * foreground, reads the lists once more, since a change may have been missed while the stream was down or the app was
 * in the background. The drawer calls this; it is only shown after sign-in.
 */
export function useLiveListUpdates(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let paused = false;
    let connection: AbortController | null = null;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let coalesce: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = false;

    const refresh = () => {
      void invalidateConversationLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: projectsKey });
    };
    const scheduleRefresh = () => {
      clearTimeout(coalesce);
      coalesce = setTimeout(refresh, COALESCE_MS);
    };

    const connect = async (): Promise<void> => {
      clearTimeout(reconnect);
      if (stopped || paused || connection) return;

      const current = new AbortController();
      connection = current;
      try {
        const res = (await expoFetch(absoluteUrl("/api/events"), {
          headers: { accept: "text/event-stream", ...authHeaders() },
          signal: current.signal,
        } as Parameters<typeof expoFetch>[1])) as unknown as Response;
        // Signed out: the auth provider takes the user back to sign-in. No reconnect.
        if (res.status === 401) {
          stopped = true;
          return;
        }
        if (!res.ok || !res.body) throw new Error(`the live updates answered HTTP ${res.status}`);

        if (connectedBefore) scheduleRefresh();
        connectedBefore = true;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end = buffer.indexOf("\n\n");
          while (end !== -1) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (block.split("\n").includes("event: changed")) scheduleRefresh();
            end = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // Aborted (the app went to the background, or the screen closed), or the server did not answer: see below.
      } finally {
        if (connection === current) connection = null;
      }
      if (!stopped && !paused) reconnect = setTimeout(() => void connect(), RECONNECT_MS);
    };

    const onAppState = (state: string) => {
      if (state === "active") {
        paused = false;
        scheduleRefresh();
        void connect();
      } else {
        // Background: the system may freeze the connection, so it is closed now and opened again in front.
        paused = true;
        clearTimeout(reconnect);
        connection?.abort();
      }
    };
    const subscription = AppState.addEventListener("change", onAppState);

    void connect();

    return () => {
      stopped = true;
      clearTimeout(reconnect);
      clearTimeout(coalesce);
      connection?.abort();
      subscription.remove();
    };
  }, [enabled, queryClient]);
}
