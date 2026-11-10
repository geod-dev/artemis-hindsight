import type { UIMessage } from "ai";
import { sandboxFileUrl } from "@/lib/sandbox-files";
import { getConfig } from "../config";
import { readSessionFile } from "../clients/toolbox-client";
import { escapeAttr } from "./memory-context";

/**
 * Attachments are files the user uploaded. They live in the sandbox at <session>/attachments/<name>.
 * A message stores only the path, as a file part whose url points at /api/conversations/<id>/files.
 */

export class AttachmentError extends Error {}

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/** Media types the model can read directly. Other files are only available to the agent through its tools. */
const MODEL_MEDIA_TYPES = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/;

type Part = UIMessage["parts"][number];
type FilePart = Extract<Part, { type: "file" }>;

function isFile(part: Part): part is FilePart {
  return part.type === "file";
}

/** The session-relative path ("attachments/<name>") of a stored file url, or null when it is not an attachment. */
export function attachmentPathOf(conversationId: string, url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://local");
  } catch {
    return null;
  }
  if (parsed.pathname !== `/api/conversations/${conversationId}/files`) return null;
  const path = parsed.searchParams.get("path");
  if (!path || !path.startsWith("attachments/") || path.includes("..")) return null;
  return path;
}

function nameOf(path: string): string {
  return path.split("/").pop() ?? path;
}

/**
 * Checks the file parts of a new user message: each must be an attachment uploaded to this conversation
 * and still present in the sandbox. Returns the parts with relative urls.
 */
export async function checkAttachments(conversationId: string, parts: UIMessage["parts"]): Promise<UIMessage["parts"]> {
  const count = parts.filter(isFile).length;
  if (count > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new AttachmentError(`a message can have at most ${MAX_ATTACHMENTS_PER_MESSAGE} files`);
  }

  const checked: UIMessage["parts"] = [];
  for (const part of parts) {
    if (!isFile(part)) {
      checked.push(part);
      continue;
    }
    const path = attachmentPathOf(conversationId, part.url);
    if (!path) throw new AttachmentError(`${part.filename ?? "a file"} was not uploaded to this conversation`);
    const exists = await readSessionFile(conversationId, path);
    if (!exists) throw new AttachmentError(`${part.filename ?? "a file"} is no longer available; upload it again`);
    checked.push({ ...part, url: sandboxFileUrl(conversationId, path), filename: nameOf(path) });
  }
  return checked;
}

/**
 * The notice the model reads before the user's text: the attachments' names and their paths.
 * The model is told in the system prompt not to edit them in place.
 */
export function attachmentNotice(conversationId: string, parts: UIMessage["parts"]): string {
  const dataRoot = getConfig().SANDBOX_DATA_ROOT;
  const lines = parts.filter(isFile).flatMap((part) => {
    const path = attachmentPathOf(conversationId, part.url);
    if (!path) return [];
    const absolute = `${dataRoot}/sessions/${conversationId}/${path}`;
    return [
      `  <attachment name="${escapeAttr(nameOf(path))}" relative_path="${escapeAttr(path)}" absolute_path="${escapeAttr(absolute)}" mime_type="${escapeAttr(part.mediaType)}" />`,
    ];
  });
  return lines.length > 0 ? `<attachments>\n${lines.join("\n")}\n</attachments>` : "";
}

/**
 * The file parts the model receives for this message: images and PDFs, read from the sandbox as data urls.
 * The stored message never contains these bytes; they are loaded again for each model call.
 */
export async function modelFileParts(conversationId: string, parts: UIMessage["parts"]): Promise<UIMessage["parts"]> {
  const out: UIMessage["parts"] = [];
  for (const part of parts.filter(isFile)) {
    if (!MODEL_MEDIA_TYPES.test(part.mediaType)) continue;
    const path = attachmentPathOf(conversationId, part.url);
    if (!path) continue;
    const file = await readSessionFile(conversationId, path);
    if (!file) continue;
    out.push({
      type: "file",
      mediaType: part.mediaType,
      filename: nameOf(path),
      url: `data:${part.mediaType};base64,${Buffer.from(file.bytes).toString("base64")}`,
    });
  }
  return out;
}
