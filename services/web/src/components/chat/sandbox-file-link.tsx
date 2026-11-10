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

/**
 * Renders a link the agent wrote as a file: [label](#sandbox-file:<path>). The path is absolute or
 * relative to the session folder. It shows as a downloadable file card; every other link stays a link.
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
  return (
    <File
      type="file"
      status={{ type: "complete" }}
      filename={name}
      mimeType={mediaTypeOf(name)}
      data={absoluteUrl(sandboxFileUrl(conversationId, filePath))}
      sourceType="url"
    />
  );
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
