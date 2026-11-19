import path from "node:path";

/**
 * Where the agent's files live.
 *   <dataRoot>/sessions/<sessionId>/              one conversation: default folder for bash, read, write and edit
 *   <dataRoot>/sessions/<sessionId>/attachments/  files the user uploaded in that conversation
 *   <dataRoot>/sessions/<sessionId>/images/       images the agent generated in that conversation
 *   <workspaceRoot>/<username>/                   one user's workspace, shared by all of that user's conversations
 *   <workspaceRoot>/<username>/projects/<id>/     one project's folder, shared by the conversations of that project
 */
export interface Roots {
  dataRoot: string;
  workspaceRoot: string;
}

export function sessionDir(roots: Roots, sessionId: string): string {
  return path.join(roots.dataRoot, "sessions", sessionId);
}

export function attachmentsDir(roots: Roots, sessionId: string): string {
  return path.join(sessionDir(roots, sessionId), "attachments");
}

export function imagesDir(roots: Roots, sessionId: string): string {
  return path.join(sessionDir(roots, sessionId), "images");
}

export function workspaceDir(roots: Roots, username: string): string {
  return path.join(roots.workspaceRoot, username);
}

/** A project's folder inside the user's workspace: <workspaceRoot>/<username>/projects/<projectId>. */
export function projectDir(roots: Roots, username: string, projectId: string): string {
  return path.join(workspaceDir(roots, username), "projects", projectId);
}

/**
 * Resolves a path the agent gave: relative paths start in the session folder, absolute paths are used as they are.
 * There is no path guard: the family shares one sandbox, and the system prompt tells the agent which folders are its own.
 */
export function resolveAgentPath(roots: Roots, sessionId: string, input: string): string {
  return path.resolve(sessionDir(roots, sessionId), input);
}

/** The path relative to the session folder, as the agent and the attachment links use it. */
export function relativeToSession(roots: Roots, sessionId: string, absolute: string): string {
  const relative = path.relative(sessionDir(roots, sessionId), absolute);
  return relative.startsWith("..") ? absolute : relative.split(path.sep).join("/");
}
