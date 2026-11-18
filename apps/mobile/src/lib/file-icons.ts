import {
  Eye,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Music,
  Pencil,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react-native";

// The file icon system for every file the app shows: composer attachments, attachments in sent messages, files the agent
// produces, and the file tools. Mirrors services/web/src/components/chat/file-kind.tsx: the same kinds, the same extensions,
// the same type colours (Tailwind's 500 shades, as hex). Keep the two in step.

export type FileKind = { Icon: LucideIcon; /** The type colour. Undefined for plain text and unknown files: they take the theme's muted colour. */ tint?: string };

const KINDS = {
  image: { Icon: FileImage, tint: "#0ea5e9" },
  pdf: { Icon: FileText, tint: "#ef4444" },
  doc: { Icon: FileText, tint: "#3b82f6" },
  sheet: { Icon: FileSpreadsheet, tint: "#10b981" },
  slides: { Icon: Presentation, tint: "#f97316" },
  archive: { Icon: FileArchive, tint: "#f59e0b" },
  code: { Icon: FileCode, tint: "#8b5cf6" },
  audio: { Icon: Music, tint: "#ec4899" },
  video: { Icon: Video, tint: "#f43f5e" },
  text: { Icon: FileText, tint: undefined },
  other: { Icon: File, tint: undefined },
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

/** The icon for a file, from its name and, when the name has no known extension, its media type. */
export function fileIconFor(name?: string, mediaType?: string): LucideIcon {
  return fileKind(name, mediaType).Icon;
}

/** The icon of a file tool in the activity line: read shows the file, write and edit show a pencil. */
export function fileToolIcon(toolName: string): LucideIcon {
  return toolName === "read" ? Eye : Pencil;
}

/**
 * The file card's geometry, as the web card (sandbox-file-link.tsx): an outer radius of 12, a 6px inset, and a tile whose
 * radius is the outer radius minus that inset (the nested-radius rule), so the curves stay concentric.
 */
export const FILE_CARD = {
  radius: 12,
  padding: 6,
  paddingRight: 10,
  gap: 10,
  tile: 36,
  tileRadius: 12 - 6,
} as const;
