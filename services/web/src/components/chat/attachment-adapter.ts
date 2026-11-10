"use client";

import type { AttachmentAdapter } from "@assistant-ui/react";
import { absoluteUrl } from "@/lib/sandbox-files";

/** Per-file size limit. Matches the server and the sandbox. */
export const MAX_ATTACHMENT_MB = 5;

/**
 * Uploads a file the user adds to the composer. The file is sent when the message is sent, so a removed
 * attachment is never uploaded. The message then holds the file's path in the sandbox, not its bytes.
 */
export function createAttachmentAdapter(conversationId: string): AttachmentAdapter {
  return {
    accept: "*",
    async add({ file }) {
      if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
        throw new Error(`${file.name} is larger than ${MAX_ATTACHMENT_MB} MB`);
      }
      return {
        id: crypto.randomUUID(),
        type: file.type.startsWith("image/") ? "image" : "file",
        name: file.name,
        contentType: file.type,
        file,
        status: { type: "requires-action", reason: "composer-send" },
      };
    },
    async send(attachment, options) {
      const form = new FormData();
      form.append("file", attachment.file);
      const res = await fetch(`/api/conversations/${conversationId}/attachments`, {
        method: "POST",
        body: form,
        signal: options?.signal,
      });
      const body = (await res.json().catch(() => null)) as { name: string; mediaType: string; url: string; error?: string } | null;
      if (!res.ok || !body) throw new Error(body?.error ?? `upload failed (HTTP ${res.status})`);
      return {
        ...attachment,
        status: { type: "complete" },
        content: [
          {
            type: "file",
            mimeType: body.mediaType,
            filename: body.name,
            // An absolute url keeps assistant-ui from reading the path as base64. The server stores the path.
            data: absoluteUrl(body.url),
          },
        ],
      };
    },
    async remove() {
      // Nothing to clean up: the file is uploaded only when the message is sent.
    },
  };
}
