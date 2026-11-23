import type { UIMessage } from "ai";
import type { MessageRow } from "@/server/repositories/message-repository";
import { activeLeafOf, branchTo } from "@/server/repositories/message-repository";
import type { MessageTree } from "./message-tree";

/** Maps stored message rows to the UI messages the chat runtime renders. Shared by the web page and the JSON API. */
export function toUiMessages(rows: MessageRow[]): UIMessage[] {
  return rows.map(toUiMessage);
}

function toUiMessage(row: MessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role,
    parts: row.parts,
    metadata: {
      createdAt: row.createdAt.toISOString(),
      ...(row.metadata?.custom ? { custom: row.metadata.custom } : {}),
      // The turn's timing: the UI reads it from metadata.custom.turnTiming, where assistant-ui puts extra metadata.
      ...(row.metadata?.turnTiming ? { turnTiming: row.metadata.turnTiming } : {}),
      // The effort a user message was sent with: editing it starts from the same effort.
      ...(row.metadata?.reasoningEffort ? { reasoningEffort: row.metadata.reasoningEffort } : {}),
      // A reply the user stopped: the clients show "Stopped by you" under it after a reload too.
      ...(row.status === "aborted" ? { stopped: true } : {}),
      // When the message last ended the branch the user was on: at a fork, the clients open the branch visited last.
      ...(row.visitedAt ? { visitedAt: row.visitedAt.toISOString() } : {}),
    },
  };
}

/**
 * Every message of a conversation with its parent, and the leaf it opens on. The rows are in insertion order, so
 * parents come first and siblings keep the order they were made in (the order the branch picker counts).
 */
export function toMessageTree(rows: MessageRow[], activeLeafId: string | null): MessageTree {
  return {
    headId: activeLeafOf(rows, activeLeafId),
    messages: rows.map((row) => ({ parentId: row.parentId, message: toUiMessage(row) })),
  };
}

/** The branch the conversation opens on, as UI messages. */
export function activeBranchOf(rows: MessageRow[], activeLeafId: string | null): UIMessage[] {
  return toUiMessages(branchTo(rows, activeLeafOf(rows, activeLeafId)));
}
