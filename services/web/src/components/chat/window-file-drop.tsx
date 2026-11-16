"use client";

import { useAui, useAuiState } from "@assistant-ui/react";
import { PaperclipIcon } from "lucide-react";
import { useEffect, useState, type FC } from "react";
import { createPortal } from "react-dom";

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

/**
 * Files dropped anywhere in the window (sidebar included) are added to the thread's composer as attachments, the
 * same as ComposerPrimitive.AttachmentDropzone does for its own area. While files are dragged over the window, an
 * overlay says where they go. Render it inside the thread, so `aui.composer` is the thread's composer and not an
 * edit composer.
 */
export const WindowFileDrop: FC = () => {
  const aui = useAui();
  const disabled = useAuiState((s) => s.thread.isDisabled || !s.thread.capabilities.attachments);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (disabled) {
      setDragging(false);
      return;
    }
    // dragenter and dragleave fire for every child element crossed; the counter is 0 only once the drag left the window.
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      // Without this the browser opens the file in the tab instead of dropping it.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (!hasFiles(event) || event.defaultPrevented) return;
      event.preventDefault();
      for (const file of Array.from(event.dataTransfer?.files ?? [])) {
        // A rejected file (too large) shows no error here, as with the dropzone primitive.
        aui.composer.addAttachment(file).catch(() => {});
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [aui, disabled]);

  if (!dragging) return null;
  return createPortal(
    <div className="bg-background/80 animate-in fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm duration-150">
      <div className="border-primary/50 text-foreground flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed">
        <PaperclipIcon className="text-primary size-8" />
        <p className="text-lg font-medium">Drop files to attach them</p>
      </div>
    </div>,
    document.body,
  );
};
