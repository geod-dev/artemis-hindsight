import { promises as fs } from "node:fs";
import path from "node:path";
import { MAX_ATTACHMENT_BYTES, MAX_SERVED_FILE_BYTES, type SavedFile } from "@artemis/contracts";
import { attachmentsDir, imagesDir, relativeToSession, type Roots } from "./paths.js";

/** A file that cannot be stored: too large, or too many files with its name. */
export class SessionFileError extends Error {}

/** Keeps letters, digits, dot, dash and underscore. Strips any folder part, so a name cannot escape its folder. */
export function sanitizeName(raw: string): string {
  const base = path.basename(raw.replace(/\\/g, "/"));
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-120) || "file";
}

/** Writes an uploaded file into <session>/attachments/. */
export function saveAttachment(
  roots: Roots,
  sessionId: string,
  rawName: string,
  bytes: Buffer,
  mediaType: string,
): Promise<SavedFile> {
  return saveUnderFreeName(roots, attachmentsDir(roots, sessionId), sessionId, rawName, bytes, mediaType, MAX_ATTACHMENT_BYTES);
}

/** Writes an image the agent generated into <session>/images/. */
export function saveGeneratedImage(
  roots: Roots,
  sessionId: string,
  rawName: string,
  bytes: Buffer,
  mediaType: string,
): Promise<SavedFile> {
  return saveUnderFreeName(roots, imagesDir(roots, sessionId), sessionId, rawName, bytes, mediaType, MAX_SERVED_FILE_BYTES);
}

/**
 * Writes the bytes into `dir`. A name that is already taken gets a numeric suffix (report.pdf, report-2.pdf, ...),
 * so an earlier file is never overwritten.
 */
async function saveUnderFreeName(
  roots: Roots,
  dir: string,
  sessionId: string,
  rawName: string,
  bytes: Buffer,
  mediaType: string,
  maxBytes: number,
): Promise<SavedFile> {
  if (bytes.byteLength > maxBytes) {
    throw new SessionFileError(`file is larger than ${maxBytes / 1024 / 1024} MB`);
  }
  await fs.mkdir(dir, { recursive: true });

  const base = sanitizeName(rawName);
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);

  for (let i = 1; i < 1000; i++) {
    const name = i === 1 ? base : `${stem}-${i}${ext}`;
    const absolutePath = path.join(dir, name);
    try {
      await fs.writeFile(absolutePath, bytes, { flag: "wx" });
      return {
        name,
        path: relativeToSession(roots, sessionId, absolutePath),
        absolutePath,
        mediaType,
        size: bytes.byteLength,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new SessionFileError("too many files with this name");
}
