import path from "node:path";

/**
 * Where the agent's files live.
 *   <dataRoot>/sessions/<sessionId>/              default folder for bash, read, write and edit
 *   <dataRoot>/sessions/<sessionId>/attachments/  files the user uploaded (the agent copies before editing)
 *   <workspaceRoot>/                              larger projects that outlive a single conversation
 */
export interface Roots {
  dataRoot: string;
  workspaceRoot: string;
}

export class PathError extends Error {}

export function sessionDir(roots: Roots, sessionId: string): string {
  return path.join(roots.dataRoot, "sessions", sessionId);
}

export function attachmentsDir(roots: Roots, sessionId: string): string {
  return path.join(sessionDir(roots, sessionId), "attachments");
}

/**
 * Resolves a path the agent gave: relative paths start in the session folder, absolute paths are used as they are.
 * Anything outside /data and /workspace is refused.
 */
export function resolveAgentPath(roots: Roots, sessionId: string, input: string): string {
  const resolved = path.resolve(sessionDir(roots, sessionId), input);
  const allowed = [roots.dataRoot, roots.workspaceRoot].map((root) => path.resolve(root));
  const inside = allowed.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!inside) throw new PathError(`path is outside /data and /workspace: ${input}`);
  return resolved;
}

/** The path relative to the session folder, as the agent and the attachment links use it. */
export function relativeToSession(roots: Roots, sessionId: string, absolute: string): string {
  const relative = path.relative(sessionDir(roots, sessionId), absolute);
  return relative.startsWith("..") ? absolute : relative.split(path.sep).join("/");
}
