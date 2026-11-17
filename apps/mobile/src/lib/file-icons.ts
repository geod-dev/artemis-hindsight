import type { GlyphName } from "@/components/glyph";

// The file icon system for every file the app shows: composer attachments, attachments in sent messages, files the agent
// produces, and the file tools. Mirrors services/web/src/components/chat/file-kind.tsx: the same kinds, the same extensions,
// the same type colours (Tailwind's 500 shades, as hex). Keep the two in step.

export type FileKind = {
  glyph: GlyphName;
  /** The type colour. Undefined for plain text and unknown files: they take the theme's muted colour. */
  tint?: string;
};

const KINDS = {
  image: { glyph: "fileImage", tint: "#0ea5e9" },
  pdf: { glyph: "fileText", tint: "#ef4444" },
  doc: { glyph: "fileText", tint: "#3b82f6" },
  sheet: { glyph: "fileSheet", tint: "#10b981" },
  slides: { glyph: "fileSlides", tint: "#f97316" },
  archive: { glyph: "fileArchive", tint: "#f59e0b" },
  code: { glyph: "fileCode", tint: "#8b5cf6" },
  audio: { glyph: "fileAudio", tint: "#ec4899" },
  video: { glyph: "fileVideo", tint: "#f43f5e" },
  text: { glyph: "fileTextPlain", tint: undefined },
  other: { glyph: "file", tint: undefined },
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

function extensionOf(name: string | undefined): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name ?? "");
  return match?.[1]?.toLowerCase() ?? "";
}

/** The icon and colour of a file: the extension first (more precise than most MIME types), then the media type. */
export function fileKind(name?: string, mediaType?: string): FileKind {
  const byExtension = EXTENSIONS[extensionOf(name)];
  if (byExtension) return KINDS[byExtension];
  const type = (mediaType ?? "").toLowerCase();
  if (type.startsWith("image/")) return KINDS.image;
  if (type.startsWith("audio/")) return KINDS.audio;
  if (type.startsWith("video/")) return KINDS.video;
  if (type === "application/pdf") return KINDS.pdf;
  if (type.startsWith("text/")) return KINDS.text;
  return KINDS.other;
}

/** The icon of a file tool in the activity line: read shows an eye, write and edit show a pencil. */
export function fileToolGlyph(toolName: string): GlyphName {
  return toolName === "read" ? "eye" : "edit";
}
