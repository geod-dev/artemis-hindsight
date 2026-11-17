import { readFileSync } from "node:fs";
import path from "node:path";
import { getConfig } from "../config";
import { escapeAttr, escapeText } from "./memory-context";

// The project tag. The template is prompts/project-context.md, read like the system prompt: on every call in
// development, once per process in production.
const PROMPT_FILE = path.join(process.cwd(), "prompts", "project-context.md");

let cached: string | undefined;

function loadTemplate(): string {
  if (process.env.NODE_ENV !== "production") return readFileSync(PROMPT_FILE, "utf8").trim();
  cached ??= readFileSync(PROMPT_FILE, "utf8").trim();
  return cached;
}

/** The project fields the agent is told about. */
export interface ProjectContext {
  id: string;
  name: string;
  color: string;
  iconFile: string | null;
  description: string | null;
}

/**
 * The project tag: the project's name, color, folder and icon, then the project template with the user's instructions.
 * It goes at the top of the first user message of a project's conversation, after the user metadata, and is rebuilt
 * every turn, so a change to the project shows on the next message.
 */
export function renderProjectMetadata(project: ProjectContext, username: string): string {
  const folder = `${getConfig().SANDBOX_WORKSPACE_ROOT}/${username}/projects/${project.id}`;
  const attributes = [
    `name="${escapeAttr(project.name)}"`,
    `color="${escapeAttr(project.color)}"`,
    `folder="${escapeAttr(folder)}"`,
    ...(project.iconFile ? [`icon_path="${escapeAttr(`${folder}/${project.iconFile}`)}"`] : []),
  ];
  const description = project.description?.trim() ? escapeText(project.description.trim()) : "None.";
  const body = loadTemplate().replace("{{DESCRIPTION}}", () => description);
  return `<project_metadata ${attributes.join(" ")}>\n${body}\n</project_metadata>`;
}
