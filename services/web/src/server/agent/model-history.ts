import type { UIMessage } from "ai";
import { getConfig } from "../config";
import type { StoredModelInput } from "../db/schema";
import { attachmentNotice, modelFileParts } from "./attachments";
import { escapeAttr, renderUserPrompt, textOf, type MemoryLookup } from "./memory-context";

/**
 * What the model reads for the latest user message, as built by toModelHistory: the text with the memory and
 * metadata tags, and the files sent as content. The file data is left out; their names and types are kept.
 */
export function latestModelInput(modelHistory: UIMessage[]): StoredModelInput | undefined {
  const latest = modelHistory.findLast((message) => message.role === "user");
  if (!latest) return undefined;
  const text = latest.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
  const files = latest.parts.flatMap((part) =>
    part.type === "file" ? [{ filename: part.filename, mediaType: part.mediaType }] : [],
  );
  return { text, files };
}

/**
 * The user metadata tag: who the user is (username, display name, avatar color) and where their workspace is. It goes
 * at the top of the first user message of each conversation.
 */
export function renderUserMetadata(user: ModelUser): string {
  const workspacePath = `${getConfig().SANDBOX_WORKSPACE_ROOT}/${user.username}`;
  const attributes = [
    `username="${escapeAttr(user.username)}"`,
    ...(user.displayName ? [`display_name="${escapeAttr(user.displayName)}"`] : []),
    ...(user.avatarColor ? [`avatar_color="${escapeAttr(user.avatarColor)}"`] : []),
    `workspace_path="${escapeAttr(workspacePath)}"`,
  ];
  return `<user_metadata ${attributes.join(" ")} />`;
}

export interface ModelUser {
  username: string;
  displayName: string | null;
  avatarColor: string | null;
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
  user: ModelUser,
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
    const content = i === first ? [renderUserMetadata(user), body].join("\n") : body;
    const files = await modelFileParts(conversationId, message.parts);

    out.push({ ...message, parts: [{ type: "text", text: content }, ...files] });
  }
  return out;
}
