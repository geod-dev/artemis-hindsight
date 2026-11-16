import { randomUUID } from "expo-crypto";
import type { useChatRuntime } from "@assistant-ui/ai-sdk";
import { absoluteUrl, apiUpload } from "@/lib/api";

type RuntimeOptions = NonNullable<Parameters<typeof useChatRuntime>[0]>;
type AttachmentAdapter = NonNullable<NonNullable<RuntimeOptions["adapters"]>["attachments"]>;

/** Per-file size limit. Matches the server and the web app. */
export const MAX_ATTACHMENT_MB = 5;

/** A file picked on the device: the picker's uri, plus what the upload needs. */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

/**
 * Uploads a file the user adds to the composer. As on the web, the file is sent with the message, so a removed
 * attachment is never uploaded, and the message then holds the file's path in the sandbox, not its bytes.
 */
export function createAttachmentAdapter(conversationId: string): AttachmentAdapter {
  return {
    accept: "*",
    async add({ file }) {
      const picked = file as unknown as PickedFile;
      if ((picked.size ?? 0) > MAX_ATTACHMENT_MB * 1024 * 1024) {
        throw new Error(`${picked.name} is larger than ${MAX_ATTACHMENT_MB} MB`);
      }
      return {
        id: randomUUID(),
        type: picked.type.startsWith("image/") ? "image" : "file",
        name: picked.name,
        contentType: picked.type,
        file,
        status: { type: "requires-action", reason: "composer-send" },
      };
    },
    async send(attachment) {
      const picked = attachment.file as unknown as PickedFile;
      const body = await apiUpload<{ name: string; mediaType: string; url: string }>(
        `/api/conversations/${conversationId}/attachments`,
        "file",
        picked,
      );
      return {
        ...attachment,
        status: { type: "complete" },
        content: [
          {
            type: "file",
            mimeType: body.mediaType,
            filename: body.name,
            // An absolute url keeps the runtime from reading the path as base64. The server stores the path.
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
