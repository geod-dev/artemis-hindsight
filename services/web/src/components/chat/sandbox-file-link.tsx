"use client";

import {
  Children,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ComponentPropsWithoutRef,
  type FC,
  type ReactNode,
} from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { File } from "@/components/assistant-ui/elements/file";
import {
  absoluteUrl,
  baseName,
  mediaTypeOf,
  parseSandboxFileHref,
  sandboxFileUrl,
} from "@/lib/sandbox-files";
import { cn } from "@/lib/utils";
import { ConversationIdContext } from "./conversation-context";
import { FileThumb, fileKind, fileMeta, isImageFile } from "./file-kind";
import { SandboxImage } from "./sandbox-image";

/**
 * Fetches the file and saves it, so the card knows when the bytes have arrived (a plain download link
 * gives no signal). If the fetch fails, the browser follows the link itself.
 */
async function downloadFile(url: string, name: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = name;
    link.click();
    // The click starts the save synchronously; give the browser a moment before freeing the blob.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch {
    window.location.assign(url);
  }
}

/**
 * A file in a reply, drawn like the composer's chips: type tile, name, type. The whole card downloads the file,
 * with a spinner until it is saved.
 */
const FileCard: FC<{ name: string; mimeType: string; url: string }> = ({ name, mimeType, url }) => {
  const kind = fileKind(name, mimeType);
  const [downloading, setDownloading] = useState(false);
  const ActionIcon = downloading ? Loader2Icon : DownloadIcon;
  return (
    <a
      href={url}
      download={name}
      aria-label={downloading ? `Downloading ${name}` : `Download ${name}`}
      aria-busy={downloading}
      className={cn(
        "[--tile-radius:0.375rem] bg-muted/50 hover:bg-muted border-foreground/10 not-prose my-1 flex w-fit max-w-72 items-center gap-2.5 rounded-xl border p-1.5 pr-2.5 text-left no-underline transition-colors active:scale-[0.99]",
        downloading && "cursor-progress",
      )}
      onClick={(event) => {
        // Modified clicks (new tab, save as) stay with the browser.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (downloading) return;
        setDownloading(true);
        void downloadFile(url, name).finally(() => setDownloading(false));
      }}
    >
      <FileThumb src={undefined} kind={kind} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground truncate text-xs font-medium" title={name}>
          {name}
        </span>
        <span className="text-muted-foreground truncate text-[11px]">{fileMeta(name, mimeType, undefined)}</span>
      </span>
      <ActionIcon
        className={cn(
          "text-muted-foreground size-4 shrink-0",
          downloading && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden
      />
    </a>
  );
};

/**
 * Renders a link the agent wrote as a file: [label](#sandbox-file:<path>). The path is absolute or
 * relative to the session folder. An image shows as the picture, any other file as a downloadable file card;
 * every other link stays a link.
 *
 * The first render is always the plain link, on the server and on the client, so the markup
 * matches during hydration. The card replaces it once the component has mounted.
 */
export const SandboxFileLink: FC<AnchorHTMLAttributes<HTMLAnchorElement>> = ({ href, children, ...rest }) => {
  const conversationId = useContext(ConversationIdContext);
  const filePath = parseSandboxFileHref(href);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (filePath === null || !conversationId || !mounted) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  const name = baseName(filePath);
  const mimeType = mediaTypeOf(name);
  const url = absoluteUrl(sandboxFileUrl(conversationId, filePath));
  const type = mimeType.toLowerCase();

  // Audio and video keep the registry's player.
  if (type.startsWith("audio/") || type.startsWith("video/")) {
    return <File type="file" status={{ type: "complete" }} filename={name} mimeType={mimeType} data={url} sourceType="url" />;
  }

  const card = <FileCard name={name} mimeType={mimeType} url={url} />;
  // An image shows as the picture itself; the card stays as its fallback when the picture cannot load.
  if (isImageFile(name, mimeType)) return <SandboxImage name={name} url={url} fallback={card} />;
  return card;
};

/** True when a sandbox file link sits anywhere inside these children. */
const holdsSandboxFileLink = (children: ReactNode): boolean =>
  Children.toArray(children).some((child) => {
    if (!isValidElement<{ href?: unknown; children?: ReactNode }>(child)) return false;
    if (typeof child.props.href === "string" && parseSandboxFileHref(child.props.href) !== null) {
      return true;
    }
    return holdsSandboxFileLink(child.props.children);
  });

/**
 * A paragraph that holds a file card is a div: the card is a div, and a div inside a p is invalid
 * HTML (hydration error). The classes match the registry's paragraph, so only the tag changes.
 */
const MarkdownParagraph: FC<ComponentPropsWithoutRef<"p">> =({ className, children, ...rest }) => {
  const classes = cn("aui-md-p my-3 leading-relaxed first:mt-0 last:mb-0", className);
  if (holdsSandboxFileLink(children)) {
    return <div className={classes} {...rest}>{children}</div>;
  }
  return <p className={classes} {...rest}>{children}</p>;
};

/**
 * Pass as `components` to MarkdownText, so the registry's markdown keeps its styling. Only links
 * and the paragraphs that hold them change.
 */
export const sandboxMarkdownComponents = { a: SandboxFileLink, p: MarkdownParagraph };
