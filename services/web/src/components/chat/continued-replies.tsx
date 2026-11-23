"use client";

import { useAuiState } from "@assistant-ui/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";

/**
 * Replies the user continued (Continue under a stopped reply) in this page, and whether a continue is running.
 * The phone has the same in apps/mobile/src/chat/continued-replies.tsx.
 *
 * A continue goes on in the same message, so the runtime still remembers that message as cancelled (it keys the stop by
 * message id and only forgets it when a run resumes a reply that is still shown). A continued reply is therefore not
 * "stopped" any more, until the user stops it again with the stop button.
 *
 * `continuing` lasts from the Continue click to the end of that run: the thread then follows the bottom, as the reply grows
 * where the user is reading, instead of bringing the question to the top as a new turn does.
 */
interface ContinuedReplies {
  ids: ReadonlySet<string>;
  continuing: boolean;
  /** Called by Continue, before the run starts. */
  markContinued: (messageId: string) => void;
  /** Called by the stop button with the reply it stops. */
  markStopped: (messageId: string | undefined) => void;
}

const NO_IDS: ReadonlySet<string> = new Set();

const ContinuedRepliesContext = createContext<ContinuedReplies>({
  ids: NO_IDS,
  continuing: false,
  markContinued: () => undefined,
  markStopped: () => undefined,
});

export const ContinuedRepliesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [ids, setIds] = useState<ReadonlySet<string>>(NO_IDS);
  const [continuing, setContinuing] = useState(false);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  // The continue is over when its run ends: the run started after the click, so wait for running, then for its end.
  const sawRun = useRef(false);
  useEffect(() => {
    if (!continuing) return;
    if (isRunning) sawRun.current = true;
    else if (sawRun.current) {
      sawRun.current = false;
      setContinuing(false);
    }
  }, [continuing, isRunning]);

  const markContinued = useCallback((messageId: string) => {
    setIds((previous) => new Set(previous).add(messageId));
    sawRun.current = false;
    setContinuing(true);
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

  const value = useMemo(
    () => ({ ids, continuing, markContinued, markStopped }),
    [ids, continuing, markContinued, markStopped],
  );
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
