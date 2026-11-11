import type { UIMessage } from "ai";
import { getConfig } from "../config";
import { attachmentNotice, modelFileParts } from "./attachments";
import { escapeAttr, renderUserPrompt, textOf, type MemoryLookup } from "./memory-context";

/**
 * The user metadata tag: who the user is and where their workspace is. It goes at the top of the first user
 * message of each conversation, so the model knows the workspace path without it being in the tool descriptions.
 */
export function renderUserMetadata(username: string): string {
  const workspacePath = `${getConfig().SANDBOX_WORKSPACE_ROOT}/${username}`;
  return `<user_metadata username="${escapeAttr(username)}" workspace_path="${escapeAttr(workspacePath)}" />`;
}

/**
 * The history as the model reads it. Each user message gets its attachment notice and its images and PDFs.
 * The first user message also gets the user metadata tag, and only the latest user message gets the memory block.
 * The stored messages are not changed.
 */
export async function toModelHistory(
  conversationId: string,
  history: UIMessage[],
  lookup: MemoryLookup,
  username: string,
): Promise<UIMessage[]> {
  let first = -1;
  let latest = -1;
  for (let i = 0; i < history.length; i++) {
    if (history[i]?.role !== "user") continue;
    if (first === -1) first = i;
    latest = i;
  }

  const out: UIMessage[] = [];
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    if (!message) continue;
    if (message.role !== "user") {
      out.push(message);
      continue;
    }

    const notice = attachmentNotice(conversationId, message.parts);
    const text = textOf(message);
    const body =
      i === latest
        ? renderUserPrompt(text, lookup, notice)
        : [notice, text].filter(Boolean).join("\n");
    const content = i === first ? [renderUserMetadata(username), body].join("\n") : body;
    const files = await modelFileParts(conversationId, message.parts);

    out.push({ ...message, parts: [{ type: "text", text: content }, ...files] });
  }
  return out;
}
