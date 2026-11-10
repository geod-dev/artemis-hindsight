import {
  attachmentSavedSchema,
  toolDefinitionSchema,
  toolInvokeResponseSchema,
  type AttachmentSaved,
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

export async function invokeToolboxTool(
  name: string,
  input: unknown,
  sessionId: string,
): Promise<ToolboxInvokeResult> {
  const res = await fetch(new URL(`/tools/${encodeURIComponent(name)}/invoke`, getConfig().TOOLBOX_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, context: { sessionId } }),
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
): Promise<AttachmentSaved> {
  const res = await fetch(new URL(`/sessions/${encodeURIComponent(sessionId)}/attachments`, getConfig().TOOLBOX_URL), {
    method: "POST",
    headers: { "content-type": mediaType, "x-attachment-name": encodeURIComponent(name) },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return attachmentSavedSchema.parse(body);
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

function errorMessage(body: unknown, status: number): string {
  return typeof body === "object" && body !== null && "error" in body ? String(body.error) : `HTTP ${status}`;
}
