"use client";

import { TextMessagePartProvider, useMessagePartText } from "@assistant-ui/react";
import { useMemo, useState, type AnchorHTMLAttributes, type FC, type PropsWithChildren } from "react";
import { SourceGlyph } from "@/components/assistant-ui/elements/sources";
import { fieldInteractive } from "@/components/assistant-ui/elements/surfaces";
import { hostOf, safeHref } from "@/components/assistant-ui/utils/href";
import { cn } from "@/lib/utils";

// The agent cites sources as one or more web links between parentheses, separated by commas:
//
//   The bill passed on Tuesday ([Le Monde](https://www.lemonde.fr/...), [BBC](https://www.bbc.com/...)).
//
// groupSourceLinks rewrites such a group, before the markdown is parsed, into links whose target is #source: followed
// by the URL, without the parentheses and commas. Each one shows as a small muted badge in the text: the site's
// favicon and the link text (the domain when the text is empty), opening the page in a new tab. The look is the
// registry Sources trigger's pill, at text size. A link outside parentheses stays a plain link.

const PREFIX = "#source:";

// One markdown link: [label](url) or [label](<url>). A bare URL may hold balanced parentheses (Wikipedia pages).
const LINK = String.raw`\[([^\]\n]*)\]\(\s*(<[^>\n]+>|[^\s()<>]+(?:\([^\s()]*\)[^\s()<>]*)*)\s*\)`;
const GROUP = new RegExp(String.raw`\(\s*(${LINK}(?:\s*[,;]?\s*${LINK})*)\s*\)`, "g");
const LINK_IN_GROUP = new RegExp(LINK, "g");
// Fenced code blocks and inline code: left as written.
const CODE = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`)/;

/** Rewrites every parenthesised group of web links in the markdown into #source: links (see the top of the file). */
export function groupSourceLinks(markdown: string): string {
  return markdown
    .split(CODE)
    .map((piece, index) => (index % 2 === 1 ? piece : piece.replace(GROUP, rewriteGroup)))
    .join("");
}

function rewriteGroup(group: string, inner: string): string {
  const links = [...inner.matchAll(LINK_IN_GROUP)].map(([, label = "", target = ""]) => ({
    label,
    url: target.replace(/^<|>$/g, "").trim(),
  }));
  // A group with a link that is not a web page (a sandbox file, an anchor) is not a source group.
  if (!links.every(({ url }) => isWebUrl(url))) return group;
  return links.map(({ label, url }) => `[${label}](<${PREFIX}${url}>)`).join(" ");
}

function isWebUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * The text part's markdown with its source groups rewritten (groupSourceLinks), for the MarkdownText inside.
 * The message keeps the text as the agent wrote it, so copying the reply copies the plain links.
 */
export const SourceGroups: FC<PropsWithChildren> = ({ children }) => {
  const { text, status } = useMessagePartText();
  const grouped = useMemo(() => groupSourceLinks(text), [text]);
  return (
    <TextMessagePartProvider text={grouped} isRunning={status.type === "running"}>
      {children}
    </TextMessagePartProvider>
  );
};

/** The cited URL of a #source: link, or null for any other link (or a URL that is not http or https). */
export function parseSourceHref(href: string | undefined): string | null {
  if (!href?.startsWith(PREFIX)) return null;
  let url = href.slice(PREFIX.length).trim();
  try {
    url = decodeURI(url);
  } catch {
    // Not percent-encoded: kept as written.
  }
  return safeHref(url) ?? null;
}

/**
 * The site's favicon, from DuckDuckGo's favicon service (it answers for any domain, with no key). The registry's
 * SourceGlyph (the domain's first letter) stands in while there is none: a site without an icon, or a failed load.
 */
const Favicon: FC<{ domain: string }> = ({ domain }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    // The glyph is 16 px in the registry: scaled down to the badge's 12 px icon size.
    return (
      <span className="flex shrink-0 [&>span]:size-3 [&>span]:text-[7px]">
        <SourceGlyph domain={domain} />
      </span>
    );
  }
  return (
    <img
      src={`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`}
      alt=""
      aria-hidden
      loading="lazy"
      referrerPolicy="no-referrer"
      className="size-3 shrink-0 rounded-[3px] object-contain"
      onError={() => setFailed(true)}
    />
  );
};

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement>;

/** Wraps the link component: #source: links render as a source badge, every other link as `Link` renders it. */
export function withSourceBadges(Link: FC<LinkProps>): FC<LinkProps> {
  const SourceOrLink: FC<LinkProps> = (props) => {
    const url = parseSourceHref(props.href);
    if (url === null) return <Link {...props} />;
    const domain = hostOf(url)?.replace(/^www\./, "") ?? url;
    const label = typeof props.children === "string" && props.children.trim() !== "" ? props.children : domain;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        data-slot="source-badge"
        className={cn(
          fieldInteractive,
          "text-muted-foreground hover:text-foreground/80 mx-0.5 inline-flex max-w-44 translate-y-[-1px] items-center gap-1 rounded-full py-[3px] ps-1 pe-1.5 align-middle text-[11px] leading-none no-underline",
        )}
      >
        <Favicon domain={domain} />
        <span className="truncate">{label}</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  };
  return SourceOrLink;
}
