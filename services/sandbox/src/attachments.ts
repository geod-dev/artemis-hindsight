import { promises as fs } from "node:fs";
import path from "node:path";
import { MAX_ATTACHMENT_BYTES, type AttachmentSaved } from "@artemis/contracts";
import { attachmentsDir, relativeToSession, type Roots } from "./paths.js";

export class AttachmentError extends Error {}

/** Keeps letters, digits, dot, dash and underscore. Strips any folder part, so a name cannot escape the attachments folder. */
export function sanitizeName(raw: string): string {
  const base = path.basename(raw.replace(/\\/g, "/"));
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-120) || "file";
}

/**
 * Writes an uploaded file into <session>/attachments/. A name that is already taken gets a numeric suffix,
 * so an earlier attachment is never overwritten.
 */
export async function saveAttachment(
  roots: Roots,
  sessionId: string,
  rawName: string,
  bytes: Buffer,
  mediaType: string,
): Promise<AttachmentSaved> {
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError(`file is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`);
  }
  const dir = attachmentsDir(roots, sessionId);
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
  throw new AttachmentError("too many attachments with this name");
}
