/**
 * Files that live in a conversation's sandbox folder. The server serves them at /api/conversations/<id>/files,
 * and messages store only the path (never the bytes). Same contract as services/web/src/lib/sandbox-files.ts.
 */

/** The prefix of the file link the agent writes: [label](#sandbox-file:<path>). */
export const SANDBOX_FILE_PREFIX = "#sandbox-file:";

export function sandboxFileUrl(conversationId: string, filePath: string): string {
  return `/api/conversations/${conversationId}/files?path=${encodeURIComponent(filePath)}`;
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

export function baseName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
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

/** The media type of a file, from its extension (the same table as the web app). */
export function mediaTypeOf(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[ext] ?? "application/octet-stream";
}

/** The extension in capitals, for the card's type line: "PDF", "PNG". Empty when the name has none. */
export function extensionLabel(fileName: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName);
  return match?.[1]?.toUpperCase() ?? "";
}
