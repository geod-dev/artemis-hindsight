"use client";

import type { FC } from "react";
import { AttachmentPrimitive, ComposerPrimitive, useAuiState } from "@assistant-ui/react";
import { XIcon } from "lucide-react";
import { useAttachmentState } from "@/components/assistant-ui/elements/attachment-state";
import { cn } from "@/lib/utils";
import { FileTile, fileKind, fileMeta } from "./file-kind";

const AttachmentChip: FC = () => {
  const { src, name, isUploading, isError, errorMessage } = useAttachmentState();
  const contentType = useAuiState((s) => s.attachment.contentType ?? "");
  const size = useAuiState((s) => s.attachment.file?.size);
  const kind = fileKind(name, contentType);
  const meta = isError ? errorMessage : isUploading ? "Uploading…" : fileMeta(name, contentType, size);

  return (
    <AttachmentPrimitive.Root
      className={cn(
        // Nested radius: outer radius minus the gap to the outer edge. The chip sits --composer-padding inside the
        // composer shell, and the tile sits p-1.5 (0.375rem) inside the chip.
        "[--chip-radius:max(0px,calc(var(--composer-radius,1rem)-var(--composer-padding,8px)))] [--tile-radius:max(0px,calc(var(--chip-radius)-0.375rem))]",
        "bg-muted/50 animate-in fade-in-0 zoom-in-95 flex max-w-64 shrink-0 items-center gap-2.5 rounded-(--chip-radius) border p-1.5 duration-200 motion-reduce:animate-none",
        isError ? "border-destructive/50" : "border-foreground/10",
      )}
    >
      <FileTile src={src} name={name} kind={kind} isUploading={isUploading} isError={isError} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium" title={name}>
          {name}
        </span>
        <span
          className={cn("truncate text-[11px]", isError ? "text-destructive" : "text-muted-foreground")}
          title={meta}
        >
          {meta}
        </span>
      </span>
      <AttachmentPrimitive.Remove asChild>
        <button
          type="button"
          aria-label={`Remove ${name}`}
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex size-6 shrink-0 items-center justify-center self-center rounded-full transition-colors active:scale-[0.96]"
        >
          <XIcon className="size-3.5" />
        </button>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};

/** The files waiting in the composer, as chips: thumbnail or type icon, name, type and size, remove button. */
export const ComposerAttachments: FC = () => (
  <div className="flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
    <ComposerPrimitive.Attachments>{() => <AttachmentChip />}</ComposerPrimitive.Attachments>
  </div>
);
