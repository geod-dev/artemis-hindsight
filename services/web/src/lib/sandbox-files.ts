/**
 * Files that live in a conversation's sandbox folder. The browser reaches them through
 * /api/conversations/<id>/files, and messages store only the path (never the bytes).
 */

/** The prefix of the file link the agent writes: [label](#sandbox-file:<path>). */
export const SANDBOX_FILE_PREFIX = "#sandbox-file:";

export function sandboxFileUrl(conversationId: string, filePath: string): string {
  return `/api/conversations/${conversationId}/files?path=${encodeURIComponent(filePath)}`;
}

/** Turns a relative URL into an absolute one, which the File element needs to build its download link. */
export function absoluteUrl(relative: string): string {
  return new URL(relative, window.location.origin).toString();
}

/** Reads the path from an agent's file link. Returns null for any other link. */
export function parseSandboxFileHref(href: string | undefined): string | null {
  if (!href?.startsWith(SANDBOX_FILE_PREFIX)) return null;
  const raw = href.slice(SANDBOX_FILE_PREFIX.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  zip: "application/zip",
};

export function mediaTypeOf(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[ext] ?? "application/octet-stream";
}

export function baseName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}
