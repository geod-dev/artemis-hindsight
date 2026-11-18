"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { dispatchListsChanged } from "@/lib/list-events";

// Several changes in a burst (a reply's end touches the conversation and clears its unread flag) read the lists once.
const COALESCE_MS = 150;

/**
 * The signed-in user's live lists: one event stream (/api/events) for the whole app. A change made in another window or
 * on the phone reads the sidebar and the new chat's lists again, as a change made here does. The browser reconnects by
 * itself; after a reconnect the lists are read once more, since a change may have been missed while the stream was down.
 * Mounted once, in the chat shell's layout.
 */
export function LiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = false;

    const refresh = () => {
      router.refresh();
      dispatchListsChanged();
    };
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, COALESCE_MS);
    };

    const source = new EventSource("/api/events");
    source.addEventListener("open", () => {
      if (connectedBefore) scheduleRefresh();
      connectedBefore = true;
    });
    source.addEventListener("changed", scheduleRefresh);

    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router]);

  return null;
}
