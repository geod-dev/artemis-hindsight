"use client";

import { useAuiState } from "@assistant-ui/react";
import { createContext, useCallback, useContext, useMemo, useState, type FC, type ReactNode } from "react";

/**
 * Replies the user continued (Continue under a stopped reply) in this page, and whether a continue is running.
 * The phone has the same in apps/mobile/src/chat/continued-replies.tsx.
 *
 * A continue goes on in the same message, so the runtime still remembers that message as cancelled (it keys the stop by
 * message id and only forgets it when a run resumes a reply that is still shown). A continued reply is therefore not
 * "stopped" any more, until the user stops it again with the stop button.
 */
interface ContinuedReplies {
  ids: ReadonlySet<string>;
  /** Called by Continue, before the run starts. */
  markContinued: (messageId: string) => void;
  /** Called by the stop button with the reply it stops. */
  markStopped: (messageId: string | undefined) => void;
}

const NO_IDS: ReadonlySet<string> = new Set();

const ContinuedRepliesContext = createContext<ContinuedReplies>({
  ids: NO_IDS,
  markContinued: () => undefined,
  markStopped: () => undefined,
});

export const ContinuedRepliesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [ids, setIds] = useState<ReadonlySet<string>>(NO_IDS);

  const markContinued = useCallback((messageId: string) => {
    setIds((previous) => new Set(previous).add(messageId));
  }, []);
  const markStopped = useCallback((messageId: string | undefined) => {
    if (!messageId) return;
    setIds((previous) => {
      if (!previous.has(messageId)) return previous;
      const next = new Set(previous);
      next.delete(messageId);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ids, markContinued, markStopped }), [ids, markContinued, markStopped]);
  return <ContinuedRepliesContext.Provider value={value}>{children}</ContinuedRepliesContext.Provider>;
};

export function useContinuedReplies(): ContinuedReplies {
  return useContext(ContinuedRepliesContext);
}

/**
 * True when the reply around the caller was stopped by the user and is not running: stopped live (the runtime's status),
 * or stored stopped (the server's `stopped` flag, after a reload), and not continued since.
 */
export function useReplyStopped(): boolean {
  const { ids } = useContinuedReplies();
  const messageId = useAuiState((s) => s.message.id);
  const stopped = useAuiState(
    (s) =>
      s.message.status?.type !== "running" &&
      ((s.message.status?.type === "incomplete" && s.message.status.reason === "cancelled") ||
        s.message.metadata.custom?.stopped === true),
  );
  return stopped && !ids.has(messageId);
}
