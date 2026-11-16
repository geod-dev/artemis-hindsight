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

/** The household's timezone: the date and time the agent is given are local to it. */
const TIMEZONE = "Europe/Paris";

/**
 * The current time tag, e.g. <current_time date="2026-11-15" weekday="Sunday" time="14:32" timezone="Europe/Paris" />.
 * It goes at the top of the latest user message, so the model knows "today" without guessing it from memory or search.
 */
export function renderCurrentTime(now: Date = new Date()): string {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, ...options }).format(now);
  const date = format({ year: "numeric", month: "2-digit", day: "2-digit" });
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" }).format(now);
  const time = format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `<current_time date="${date}" weekday="${weekday}" time="${time}" timezone="${TIMEZONE}" />`;
}

export interface ModelUser {
  username: string;
  displayName: string | null;
  avatarColor: string | null;
}

/**
 * The history as the model reads it. Each user message gets its attachment notice and its images and PDFs.
 * The first user message also gets the user metadata tag, and only the latest user message gets the current time and
 * the memory block.
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
        ? [renderCurrentTime(), renderUserPrompt(text, lookup, notice)].join("\n")
        : [notice, text].filter(Boolean).join("\n");
    const content = i === first ? [renderUserMetadata(user), body].join("\n") : body;
    const files = await modelFileParts(conversationId, message.parts);

    out.push({ ...message, parts: [{ type: "text", text: content }, ...files] });
  }
  return out;
}
