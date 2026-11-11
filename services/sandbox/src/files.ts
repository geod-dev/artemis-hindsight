import { promises as fs } from "node:fs";
import path from "node:path";
import {
  MAX_ATTACHMENT_BYTES,
  type FsEditRequest,
  type FsEditResult,
  type FsReadRequest,
  type FsReadResult,
  type FsWriteRequest,
  type FsWriteResult,
} from "@artemis/contracts";
import { relativeToSession, resolveAgentPath, type Roots } from "./paths.js";

/** An error the agent can act on. The toolbox returns it to the model as a tool error. */
export class FileError extends Error {}

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_CHARS = 2000;

/** Runs `fn` and turns filesystem and path errors into FileError messages the agent can read. */
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof FileError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new FileError("no such file; check the path, or use write to create it");
    if (code === "EACCES" || code === "EPERM") throw new FileError("permission denied");
    if (code === "EISDIR") throw new FileError("path is a directory, not a file");
    throw error;
  }
}

function resolve(roots: Roots, sessionId: string, input: string): string {
  return resolveAgentPath(roots, sessionId, input);
}

export async function readForAgent(roots: Roots, input: FsReadRequest & { sessionId: string }): Promise<FsReadResult> {
  const absolute = resolve(roots, input.sessionId, input.path);
  const rel = relativeToSession(roots, input.sessionId, absolute);

  return guarded(async () => {
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) throw new FileError("path is a directory; use bash to list it");

    const imageType = IMAGE_MEDIA_TYPES[path.extname(absolute).toLowerCase()];
    if (imageType) {
      if (stat.size > MAX_ATTACHMENT_BYTES) throw new FileError("image is larger than 5 MB");
      const bytes = await fs.readFile(absolute);
      return { kind: "image", path: rel, mediaType: imageType, base64: bytes.toString("base64"), size: stat.size };
    }

    const bytes = await fs.readFile(absolute);
    if (bytes.subarray(0, 8192).includes(0)) {
      throw new FileError("binary file; inspect it with bash instead (for example file or xxd)");
    }

    const lines = bytes.toString("utf8").split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop(); // trailing newline is not a line

    const total = lines.length;
    const offset = input.offset ?? 1;
    const limit = input.limit ?? DEFAULT_LINE_LIMIT;
    if (total > 0 && offset > total) throw new FileError(`offset ${offset} is past the end of the file (${total} lines)`);

    const start = offset - 1;
    const slice = lines.slice(start, start + limit);
    const content = slice
      .map((line, i) => {
        const shown = line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)} [line truncated]` : line;
        return `${String(start + i + 1).padStart(6)}\t${shown}`;
      })
      .join("\n");

    const toLine = start + slice.length;
    return {
      kind: "text",
      path: rel,
      content,
      totalLines: total,
      fromLine: slice.length > 0 ? offset : 0,
      toLine,
      truncated: toLine < total,
    };
  });
}

export async function writeForAgent(roots: Roots, input: FsWriteRequest & { sessionId: string }): Promise<FsWriteResult> {
  const absolute = resolve(roots, input.sessionId, input.path);
  const rel = relativeToSession(roots, input.sessionId, absolute);

  return guarded(async () => {
    let created = true;
    try {
      const stat = await fs.stat(absolute);
      if (stat.isDirectory()) throw new FileError("path is a directory, not a file");
      created = false;
    } catch (error) {
      if (error instanceof FileError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, input.content, "utf8");
    return { path: rel, created, bytes: Buffer.byteLength(input.content, "utf8") };
  });
}

export async function editForAgent(roots: Roots, input: FsEditRequest & { sessionId: string }): Promise<FsEditResult> {
  const absolute = resolve(roots, input.sessionId, input.path);
  const rel = relativeToSession(roots, input.sessionId, absolute);
  const replaceAll = input.replaceAll ?? false;

  return guarded(async () => {
    const content = await fs.readFile(absolute, "utf8");
    const occurrences = content.split(input.oldString).length - 1;

    if (occurrences === 0) {
      throw new FileError(
        "oldString was not found in the file. Read the file again and copy the exact text, including whitespace and line breaks.",
      );
    }
    if (occurrences > 1 && !replaceAll) {
      throw new FileError(
        `oldString matches ${occurrences} places. Add surrounding lines to make it unique, or set replaceAll to true.`,
      );
    }

    const updated = replaceAll
      ? content.split(input.oldString).join(input.newString)
      : content.replace(input.oldString, () => input.newString);
    await fs.writeFile(absolute, updated, "utf8");
    return { path: rel, replacements: replaceAll ? occurrences : 1 };
  });
}

/** Reads a file's bytes for download or preview. The attachment and download links use this. */
export async function serveFile(
  roots: Roots,
  sessionId: string,
  input: string,
): Promise<{ bytes: Buffer; mediaType: string; name: string }> {
  const absolute = resolve(roots, sessionId, input);
  return guarded(async () => {
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) throw new FileError("path is a directory, not a file");
    if (stat.size > MAX_ATTACHMENT_BYTES * 4) throw new FileError("file is too large to download here");
    const bytes = await fs.readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    const mediaType = IMAGE_MEDIA_TYPES[ext] ?? MEDIA_TYPES[ext] ?? "application/octet-stream";
    return { bytes, mediaType, name: path.basename(absolute) };
  });
}

const MEDIA_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
};
