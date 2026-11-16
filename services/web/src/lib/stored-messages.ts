import type { UIMessage } from "ai";
import type { MessageRow } from "@/server/repositories/message-repository";

/** Maps stored message rows to the UI messages the chat runtime renders. Shared by the web page and the JSON API. */
export function toUiMessages(rows: MessageRow[]): UIMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: row.parts,
    metadata: {
      createdAt: row.createdAt.toISOString(),
      ...(row.metadata?.custom ? { custom: row.metadata.custom } : {}),
      // The turn's timing: the UI reads it from metadata.custom.turnTiming, where assistant-ui puts extra metadata.
      ...(row.metadata?.turnTiming ? { turnTiming: row.metadata.turnTiming } : {}),
    },
  }));
}
