"use client";

import { useState, type FC, type ReactNode } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ImagePreview } from "./file-kind";

/**
 * An image file in a reply (one the agent generated, or any image it linked), shown as the picture itself instead of a
 * file card: a skeleton while it loads, then the picture, which opens the preview, with a download button in its corner.
 * If the picture cannot load, `fallback` (the file card) is shown instead.
 */
export const SandboxImage: FC<{ name: string; url: string; fallback: ReactNode }> = ({ name, url, fallback }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  if (status === "failed") return fallback;
  const loaded = status === "loaded";

  return (
    <div className="not-prose relative my-2 w-fit max-w-full">
      {!loaded && <Skeleton aria-label={`Loading ${name}`} className="aspect-square w-64 max-w-full rounded-xl" />}
      <ImagePreview src={url} name={name}>
        <button
          type="button"
          aria-label={`Preview ${name}`}
          className={cn(
            "border-foreground/10 block cursor-zoom-in overflow-hidden rounded-xl border transition-transform active:scale-[0.99] motion-reduce:transition-none",
            !loaded && "absolute inset-0 opacity-0",
          )}
        >
          <img
            src={url}
            alt={name}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("failed")}
            className="block h-auto max-h-96 w-auto max-w-full"
          />
        </button>
      </ImagePreview>
      {loaded && (
        <Button
          asChild
          variant="secondary"
          size="icon-sm"
          className="bg-background/80 hover:bg-background absolute right-2 bottom-2 rounded-full backdrop-blur-sm"
        >
          <a href={url} download={name} aria-label={`Download ${name}`}>
            <DownloadIcon />
          </a>
        </Button>
      )}
    </div>
  );
};
