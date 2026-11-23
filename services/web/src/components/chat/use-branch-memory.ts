"use client";

import type { AssistantRuntime } from "@assistant-ui/react";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { branchVisitOrder, hasBranches, type MessageTree } from "@/lib/message-tree";

// Keeps the conversation on the branch the user chose, across reloads and devices. The phone has the same hooks in
// apps/mobile/src/chat/use-branch-memory.ts.

/**
 * The runtime's `unstable_onBranchChange`: each switch the user makes (the branch picker) is sent to the server, which
 * opens the conversation on that branch next time and saves that branch to memory. Switches made while `restoring` is
 * set are not sent: they only rebuild what the server already has.
 */
export function useBranchSaving(saveBranch: (leafId: string) => void): {
  onBranchChange: (event: { headId: string | null }) => void;
  restoring: RefObject<boolean>;
} {
  const restoring = useRef(false);
  const saveRef = useRef(saveBranch);
  useEffect(() => {
    saveRef.current = saveBranch;
  });
  const onBranchChange = useCallback((event: { headId: string | null }) => {
    if (restoring.current || !event.headId) return;
    saveRef.current(event.headId);
  }, []);
  return { onBranchChange, restoring };
}

/**
 * Once the conversation is loaded and idle, replays the visits recorded on the server, oldest first, so every fork opens
 * on the branch visited last there: the runtime keeps, at each fork, the branch it last went through. Only the tree the
 * conversation opened with is replayed.
 */
export function useRestoreBranches(runtime: AssistantRuntime, tree: MessageTree, restoring: RefObject<boolean>): void {
  const opened = useRef(tree);
  useEffect(() => {
    const visits = opened.current;
    if (!hasBranches(visits)) return undefined;
    const thread = runtime.thread;
    let done = false;
    const restore = () => {
      const state = thread.getState();
      if (done || state.isRunning || state.messages.length === 0) return;
      done = true;
      restoring.current = true;
      try {
        // Any visible message reaches the thread's branch switch; the first one is always there.
        const first = thread.getMessageByIndex(0);
        for (const id of branchVisitOrder(visits)) {
          try {
            first.switchToBranch({ branchId: id });
          } catch {
            // A message the runtime does not hold is skipped.
          }
        }
      } finally {
        restoring.current = false;
      }
    };
    restore();
    if (done) return undefined;
    // The conversation opened on a running reply: restore once it ends.
    const unsubscribe = thread.subscribe(() => {
      restore();
      if (done) unsubscribe();
    });
    return unsubscribe;
  }, [runtime, restoring]);
}
