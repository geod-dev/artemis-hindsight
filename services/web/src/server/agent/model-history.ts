import type { InstalledSkill } from "@artemis/contracts";
import type { UIMessage } from "ai";
import { listSkills } from "../clients/toolbox-client";
import { getConfig } from "../config";
import type { StoredModelInput } from "../db/schema";
import { attachmentNotice, modelFileParts } from "./attachments";
import { escapeAttr, escapeText, renderUserPrompt, textOf, type MemoryLookup } from "./memory-context";
import { renderProjectMetadata, type ProjectContext } from "./project-context";

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

/** Longest description shown per skill: Claude's format caps a description at 1024 characters. */
const MAX_SKILL_DESCRIPTION = 1024;

/**
 * The user's skills the agent can use: those whose SKILL.md has a description. Best effort: when the sandbox does not
 * answer, the turn goes on without skills.
 */
export async function loadUsableSkills(username: string): Promise<InstalledSkill[]> {
  try {
    return (await listSkills(username, 3_000)).filter((skill) => !skill.error);
  } catch (error) {
    console.warn("listing the skills failed", { reason: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * The skills tag: each skill's name, description and SKILL.md path. The agent reads a SKILL.md when a task matches its
 * description. It goes in the first user message, after the user metadata, and is left out when the user has no skill.
 * It is rebuilt every turn, so a skill added or removed shows up on the next message.
 */
export function renderAvailableSkills(skills: InstalledSkill[]): string {
  if (skills.length === 0) return "";
  const rows = skills.map((skill) => {
    const description =
      skill.description.length > MAX_SKILL_DESCRIPTION
        ? `${skill.description.slice(0, MAX_SKILL_DESCRIPTION - 1)}…`
        : skill.description;
    return `  <skill name="${escapeAttr(skill.name)}" path="${escapeAttr(skill.path)}">${escapeText(description)}</skill>`;
  });
  return ["<available_skills>", ...rows, "</available_skills>"].join("\n");
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
 * The first user message also gets the user metadata, the project tag (when the conversation has a project) and the
 * skills tags, and only the latest user message gets the current time and the memory block.
 * The stored messages are not changed.
 */
export async function toModelHistory(
  conversationId: string,
  history: UIMessage[],
  lookup: MemoryLookup,
  user: ModelUser,
  skills: InstalledSkill[] = [],
  project: ProjectContext | null = null,
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
    const content =
      i === first
        ? [
            renderUserMetadata(user),
            project ? renderProjectMetadata(project, user.username) : "",
            renderAvailableSkills(skills),
            body,
          ]
            .filter(Boolean)
            .join("\n")
        : body;
    const files = await modelFileParts(conversationId, message.parts);

    out.push({ ...message, parts: [{ type: "text", text: content }, ...files] });
  }
  return out;
}
