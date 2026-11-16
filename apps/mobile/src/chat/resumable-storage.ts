import type { createResumableSessionStorage } from "@assistant-ui/ai-sdk";

type ResumableStorage = ReturnType<typeof createResumableSessionStorage>;

/**
 * The pending turn of ONE conversation, kept in memory. The web app keeps it in session storage; the app keeps it
 * here, because it is only needed while the app runs. Created per conversation, so a reply running in one
 * conversation is never resumed in another. `initial` is the turn the server reports as running when the
 * conversation opens: the app joins it instead of showing a stale reply.
 */
export function createConversationResumableStorage(initial: string | null): ResumableStorage {
  let streamId = initial;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    getStreamId: () => streamId,
    setStreamId: (id) => {
      streamId = id;
      notify();
    },
    clear: () => {
      streamId = null;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
