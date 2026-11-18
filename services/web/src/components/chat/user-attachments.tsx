"use client";

import type { FC } from "react";
import { AttachmentPrimitive, MessagePrimitive, useAuiState } from "@assistant-ui/react";
import { useAttachmentState } from "@/components/assistant-ui/elements/attachment-state";
import { FileTile, fileKind, fileMeta, ImagePreview, isImageFile } from "./file-kind";

/**
 * One attachment of a sent message. A picture is a tile that opens the preview. Any other file is a card with its type
 * icon, its name and its type and size, as the composer's chips show it, without the remove button.
 */
const SentAttachment: FC = () => {
  const { src, name } = useAttachmentState();
  const contentType = useAuiState((s) => s.attachment.contentType ?? "");
  const size = useAuiState((s) => s.attachment.file?.size);

  if (isImageFile(name, contentType) && src) {
    return (
      <AttachmentPrimitive.Root className="animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none">
        <ImagePreview src={src} name={name}>
          <button
            type="button"
            aria-label={`Preview ${name}`}
            className="block size-14 cursor-zoom-in overflow-hidden rounded-xl active:scale-[0.96]"
          >
            <img src={src} alt="" className="size-full object-cover" />
          </button>
        </ImagePreview>
      </AttachmentPrimitive.Root>
    );
  }

  // The file's own icon: the message holds the file's path in the sandbox, not a picture of it.
  const meta = fileMeta(name, contentType, size);
  return (
    <AttachmentPrimitive.Root className="[--tile-radius:0.5rem] bg-muted/50 border-foreground/10 animate-in fade-in-0 zoom-in-95 flex max-w-64 items-center gap-2.5 rounded-xl border p-1.5 duration-200 motion-reduce:animate-none">
      <FileTile src={undefined} name={name} kind={fileKind(name, contentType)} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium" title={name}>
          {name}
        </span>
        <span className="text-muted-foreground truncate text-[11px]" title={meta}>
          {meta}
        </span>
      </span>
    </AttachmentPrimitive.Root>
  );
};

/**
 * The attachments of a sent message, above its bubble. Replaces the library's UserMessageAttachments, whose files
 * show a generic icon: the downloaded component is never edited, so this is our own.
 */
export const UserMessageAttachments: FC = () => (
  <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2 empty:hidden">
    <MessagePrimitive.Attachments>{() => <SentAttachment />}</MessagePrimitive.Attachments>
  </div>
);
