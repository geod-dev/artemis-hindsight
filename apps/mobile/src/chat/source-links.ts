// Source citations, as the web app renders them (services/web/src/components/chat/source-link.tsx). Same rules, same
// regexes: keep the two in step. The agent cites sources as web links between parentheses, separated by commas:
//
//   The bill passed on Tuesday ([Le Monde](https://www.lemonde.fr/...), [BBC](https://www.bbc.com/...)).
//
// groupSourceLinks rewrites such a group, before the markdown is parsed, into links whose target is #source: followed by
// the URL. Each one shows as a small pill: the site's icon and the link text (the domain when the text is empty).

const PREFIX = "#source:";

// One markdown link: [label](url) or [label](<url>). A bare URL may hold balanced parentheses (Wikipedia pages).
const LINK = String.raw`\[([^\]\n]*)\]\(\s*(<[^>\n]+>|[^\s()<>]+(?:\([^\s()]*\)[^\s()<>]*)*)\s*\)`;
const GROUP = new RegExp(String.raw`\(\s*(${LINK}(?:\s*[,;]?\s*${LINK})*)\s*\)`, "g");
const LINK_IN_GROUP = new RegExp(LINK, "g");
// Fenced code blocks and inline code: left as written.
const CODE = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`)/;

/** Rewrites every parenthesised group of web links in the markdown into #source: links. */
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

/** The cited URL of a #source: link, or null for any other link. */
export function parseSourceHref(href: string | undefined): string | null {
  if (!href?.startsWith(PREFIX)) return null;
  let url = href.slice(PREFIX.length).trim();
  try {
    url = decodeURI(url);
  } catch {
    // Not percent-encoded: kept as written.
  }
  return isWebUrl(url) ? url : null;
}

/** The host of a URL without "www.", the label of a source with no text. */
export function domainOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
