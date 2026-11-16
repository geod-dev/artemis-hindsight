"use client";

import type { FC, ReactNode } from "react";
import {
  AlertCircleIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  type LucideIcon,
  MusicIcon,
  PresentationIcon,
  VideoIcon,
} from "lucide-react";
import { formatFileSize } from "@/components/assistant-ui/elements/file";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The file icon system shared by the composer chips and the files in messages: a coloured type icon
 * per kind of file, or the picture itself for an image.
 */

export type FileKind = { Icon: LucideIcon; tone: string };

const KINDS = {
  image: { Icon: FileImageIcon, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  pdf: { Icon: FileTextIcon, tone: "bg-red-500/15 text-red-600 dark:text-red-400" },
  doc: { Icon: FileTextIcon, tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  sheet: { Icon: FileSpreadsheetIcon, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  slides: { Icon: PresentationIcon, tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  archive: { Icon: FileArchiveIcon, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  code: { Icon: FileCodeIcon, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  audio: { Icon: MusicIcon, tone: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  video: { Icon: VideoIcon, tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  text: { Icon: FileTextIcon, tone: "bg-foreground/10 text-muted-foreground" },
  other: { Icon: FileIcon, tone: "bg-foreground/10 text-muted-foreground" },
} satisfies Record<string, FileKind>;

type KindName = keyof typeof KINDS;

const EXTENSIONS: Record<string, KindName> = {};
const register = (kind: KindName, exts: string) => exts.split(" ").forEach((ext) => (EXTENSIONS[ext] = kind));
register("image", "png jpg jpeg gif webp svg bmp ico heic avif tif tiff");
register("pdf", "pdf");
register("doc", "doc docx odt rtf pages");
register("sheet", "xls xlsx xlsm ods csv tsv numbers");
register("slides", "ppt pptx odp key");
register("archive", "zip tar gz tgz bz2 xz 7z rar");
register(
  "code",
  "js mjs cjs jsx ts tsx py rb go rs java kt c h cpp hpp cs php sh bash ps1 sql html css scss json yaml yml toml xml ipynb",
);
register("audio", "mp3 wav ogg m4a flac aac opus");
register("video", "mp4 mov webm mkv avi");
register("text", "txt md markdown log");

const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** Picks the icon from the extension first (more precise than most browsers' MIME types), then the MIME type. */
export function fileKind(name: string, contentType: string): FileKind {
  const byExt = EXTENSIONS[extensionOf(name)];
  if (byExt) return KINDS[byExt];
  const type = contentType.toLowerCase();
  if (type.startsWith("image/")) return KINDS.image;
  if (type.startsWith("audio/")) return KINDS.audio;
  if (type.startsWith("video/")) return KINDS.video;
  if (type === "application/pdf") return KINDS.pdf;
  if (type.startsWith("text/")) return KINDS.text;
  return KINDS.other;
}

/** True when the file shows as a picture: an image extension or an image/* MIME type. */
export const isImageFile = (name: string, contentType: string) => fileKind(name, contentType) === KINDS.image;

/** "PDF · 1.2 MB": the extension (or the MIME subtype), and the size when it is known. */
export function fileMeta(name: string, contentType: string, size: number | undefined): string {
  const ext = extensionOf(name).toUpperCase();
  const subtype = contentType.split("/")[1]?.toUpperCase();
  const label = ext || (subtype && subtype !== "OCTET-STREAM" ? subtype : "File");
  return size === undefined ? label : `${label} · ${formatFileSize(size)}`;
}

/** The picture enlarged, in a dialog. Its trigger is the child: a tile, or a whole card. */
export const ImagePreview: FC<{ src: string; name: string; children: ReactNode }> = ({ src, name, children }) => (
  <Dialog>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent className="p-2 sm:max-w-3xl">
      <DialogTitle className="sr-only">Preview {name}</DialogTitle>
      <img src={src} alt={name} className="mx-auto block max-h-[80vh] w-auto max-w-full rounded-sm object-contain" />
    </DialogContent>
  </Dialog>
);

/**
 * The square tile, not interactive: the picture for an image, a coloured type icon otherwise, with a spinner
 * or an error mark over it. Its corner radius comes from the --tile-radius variable the parent sets.
 */
export const FileThumb: FC<{
  src: string | undefined;
  kind: FileKind;
  isUploading?: boolean;
  isError?: boolean;
}> = ({ src, kind, isUploading = false, isError = false }) => (
  <span
    className={cn(
      "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-(--tile-radius)",
      !src && kind.tone,
    )}
  >
    {src ? <img src={src} alt="" className="size-full object-cover" /> : <kind.Icon className="size-[18px]" />}
    {(isUploading || isError) && (
      <span className="bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
        {isError ? (
          <AlertCircleIcon className="text-destructive size-4" />
        ) : (
          <Loader2Icon className="text-muted-foreground size-4 animate-spin motion-reduce:animate-none" />
        )}
      </span>
    )}
  </span>
);

/** The composer chip's tile: the thumb, and for an image a button that opens the preview. */
export const FileTile: FC<{
  src: string | undefined;
  name: string;
  kind: FileKind;
  isUploading?: boolean;
  isError?: boolean;
}> = ({ src, name, ...thumb }) => {
  if (!src) return <FileThumb src={undefined} {...thumb} />;
  return (
    <ImagePreview src={src} name={name}>
      <button
        type="button"
        aria-label={`Preview ${name}`}
        className="shrink-0 cursor-zoom-in rounded-(--tile-radius) active:scale-[0.96]"
      >
        <FileThumb src={src} {...thumb} />
      </button>
    </ImagePreview>
  );
};
