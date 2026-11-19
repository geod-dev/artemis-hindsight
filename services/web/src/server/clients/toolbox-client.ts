import {
  installedSkillListSchema,
  installedSkillSchema,
  savedFileSchema,
  toolDefinitionSchema,
  toolInvokeResponseSchema,
  type InstalledSkill,
  type SavedFile,
  type SkillInstallRequest,
  type ToolDefinition,
} from "@artemis/contracts";
import { z } from "zod";
import { getConfig } from "../config";

// Client for the toolbox service: lists tools, runs them, and stores and serves session files.

const listSchema = z.array(toolDefinitionSchema);

export async function listToolboxTools(): Promise<ToolDefinition[]> {
  const res = await fetch(new URL("/tools", getConfig().TOOLBOX_URL), {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`toolbox /tools failed with HTTP ${res.status}`);
  return listSchema.parse(await res.json());
}

export type ToolboxInvokeResult = { ok: true; output: unknown } | { ok: false; error: string };

/**
 * Who the tool runs for: the conversation's session folder and the user whose memory the memory tools use. No username
 * in an unpersonalized temporary chat, where the agent must not know who the user is.
 */
export interface ToolCallContext {
  sessionId: string;
  username?: string;
}

export async function invokeToolboxTool(
  name: string,
  input: unknown,
  context: ToolCallContext,
): Promise<ToolboxInvokeResult> {
  const res = await fetch(new URL(`/tools/${encodeURIComponent(name)}/invoke`, getConfig().TOOLBOX_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, context }),
    signal: AbortSignal.timeout(330_000),
  });
  const body: unknown = await res.json().catch(() => null);
  const parsed = toolInvokeResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: `toolbox returned HTTP ${res.status} with an unexpected body` };
  }
  return parsed.data;
}

/** Stores an uploaded file in the conversation's attachments folder. */
export async function uploadAttachment(
  sessionId: string,
  name: string,
  bytes: ArrayBuffer,
  mediaType: string,
): Promise<SavedFile> {
  const res = await fetch(new URL(`/sessions/${encodeURIComponent(sessionId)}/attachments`, getConfig().TOOLBOX_URL), {
    method: "POST",
    headers: { "content-type": mediaType, "x-attachment-name": encodeURIComponent(name) },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return savedFileSchema.parse(body);
}

/** Reads a session file. Returns null when it does not exist. */
export async function readSessionFile(
  sessionId: string,
  filePath: string,
): Promise<{ bytes: Uint8Array; mediaType: string; contentDisposition: string } | null> {
  const url = new URL(`/sessions/${encodeURIComponent(sessionId)}/files`, getConfig().TOOLBOX_URL);
  url.searchParams.set("path", filePath);
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(errorMessage(await res.json().catch(() => null), res.status));
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mediaType: res.headers.get("content-type") ?? "application/octet-stream",
    contentDisposition: res.headers.get("content-disposition") ?? "attachment",
  };
}

/** Creates a user's workspace folder. Idempotent. */
export async function ensureWorkspace(username: string): Promise<void> {
  await sendFolderRequest("PUT", `/workspaces/${encodeURIComponent(username)}`);
}

/** Removes a user's workspace folder and everything in it. */
export async function removeWorkspace(username: string): Promise<void> {
  await sendFolderRequest("DELETE", `/workspaces/${encodeURIComponent(username)}`);
}

/** Removes a conversation's session folder: its files and attachments. */
export async function removeSession(sessionId: string): Promise<void> {
  await sendFolderRequest("DELETE", `/sessions/${encodeURIComponent(sessionId)}`);
}

function projectPath(username: string, projectId: string, suffix = ""): string {
  return `/workspaces/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectId)}${suffix}`;
}

/** Creates a project's folder in the user's workspace. Idempotent. */
export async function ensureProjectFolder(username: string, projectId: string): Promise<void> {
  await sendFolderRequest("PUT", projectPath(username, projectId));
}

/** Removes a project's folder and everything in it, its icon included. */
export async function removeProjectFolder(username: string, projectId: string): Promise<void> {
  await sendFolderRequest("DELETE", projectPath(username, projectId));
}

/** Stores a project's icon, replacing the previous one. Returns the icon's file name, e.g. "icon.png". */
export async function saveProjectIcon(
  username: string,
  projectId: string,
  bytes: ArrayBuffer,
  mediaType: string,
): Promise<string> {
  const res = await fetch(new URL(projectPath(username, projectId, "/icon"), getConfig().TOOLBOX_URL), {
    method: "PUT",
    headers: { "content-type": mediaType },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return z.object({ file: z.string() }).parse(body).file;
}

/** Reads a project's icon. Returns null when the project has none. */
export async function readProjectIcon(
  username: string,
  projectId: string,
): Promise<{ bytes: ArrayBuffer; mediaType: string } | null> {
  const res = await fetch(new URL(projectPath(username, projectId, "/icon"), getConfig().TOOLBOX_URL), {
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(errorMessage(await res.json().catch(() => null), res.status));
  return {
    bytes: await res.arrayBuffer(),
    mediaType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** Removes a project's icon, keeping its folder. */
export async function removeProjectIcon(username: string, projectId: string): Promise<void> {
  await sendFolderRequest("DELETE", projectPath(username, projectId, "/icon"));
}

/** A user's skills: the folders in <workspace>/<username>/skills. */
export async function listSkills(username: string, timeoutMs = 10_000): Promise<InstalledSkill[]> {
  const res = await fetch(skillsUrl(username), { signal: AbortSignal.timeout(timeoutMs) });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return installedSkillListSchema.parse(body).skills;
}

/** Writes a skill folder, replacing the one with the same name. */
export async function installSkill(username: string, folder: string, request: SkillInstallRequest): Promise<InstalledSkill> {
  const res = await fetch(skillsUrl(username, folder), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(120_000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return installedSkillSchema.parse(body);
}

/** Removes a skill folder. Returns false when there was no such skill. */
export async function removeSkill(username: string, folder: string): Promise<boolean> {
  const res = await fetch(skillsUrl(username, folder), { method: "DELETE", signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(errorMessage(await res.json().catch(() => null), res.status));
  return true;
}

function skillsUrl(username: string, folder?: string): URL {
  const base = `/workspaces/${encodeURIComponent(username)}/skills`;
  return new URL(folder ? `${base}/${encodeURIComponent(folder)}` : base, getConfig().TOOLBOX_URL);
}

async function sendFolderRequest(method: "PUT" | "DELETE", path: string): Promise<void> {
  const res = await fetch(new URL(path, getConfig().TOOLBOX_URL), { method, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new Error(errorMessage(body, res.status));
  }
}

function errorMessage(body: unknown, status: number): string {
  return typeof body === "object" && body !== null && "error" in body ? String(body.error) : `HTTP ${status}`;
}
