import { promises as fs } from "node:fs";
import path from "node:path";
import { sessionDir, workspaceDir, type Roots } from "./paths.js";

// Folder lifecycle for users and conversations. The usernames and session ids are validated by the caller.

export async function ensureWorkspace(roots: Roots, username: string): Promise<void> {
  // The skills folder is created with the workspace, so the agent finds where its skills go.
  await fs.mkdir(path.join(workspaceDir(roots, username), "skills"), { recursive: true });
}

export async function removeWorkspace(roots: Roots, username: string): Promise<void> {
  await fs.rm(workspaceDir(roots, username), { recursive: true, force: true });
}

export async function removeSession(roots: Roots, sessionId: string): Promise<void> {
  await fs.rm(sessionDir(roots, sessionId), { recursive: true, force: true });
}
