"use client";

import { BrainIcon, GlobeIcon, SearchIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

/** The Exa tools the toolbox exposes through its MCP connection. */
export const EXA_SEARCH_TOOL = "exa_web_search_exa";
export const EXA_FETCH_TOOL = "exa_web_fetch_exa";
export const EXA_RESEARCH_TOOL = "exa_agent_run";
export const EXA_TOOLS = new Set([EXA_SEARCH_TOOL, EXA_FETCH_TOOL, EXA_RESEARCH_TOOL]);

export interface ExaToolView {
  /** The row's text: the query for a search, the page's title for a fetch. */
  label: string;
  /** The icon when the call is done. A search shows a magnifier; a fetch shows the page's favicon instead. */
  icon?: ReactNode;
  /** The text of the result, shown when the row is expanded. */
  text: string;
}

/** How an Exa call looks in the run: the query as label for a search, the page title and favicon for a fetch. */
export function exaToolView(toolName: string, args: Record<string, unknown>, result: unknown): ExaToolView {
  const text = resultText(result);
  const query = typeof args.query === "string" ? args.query.trim() : "";

  if (toolName === EXA_SEARCH_TOOL) {
    return { label: query || "Web search", icon: <SearchIcon aria-label="Search" className="size-3.5 text-muted-foreground" />, text };
  }

  // Deep research: a multi-step agent run. A resumed run has no query, so it keeps the generic label.
  if (toolName === EXA_RESEARCH_TOOL) {
    return { label: query || "Deep research", icon: <BrainIcon aria-label="Deep research" className="size-3.5 text-muted-foreground" />, text };
  }

  const urls = stringList(args.urls);
  const titles = pageTitles(text);
  const host = hostOf(urls[0]);
  const first = titles[0] ?? host ?? "Page";
  const more = urls.length - 1;
  return {
    label: more > 0 ? `${first} +${more}` : first,
    icon: urls[0] ? <PageFavicon url={urls[0]} /> : <GlobeIcon aria-label="Page" className="size-3.5 text-muted-foreground" />,
    text,
  };
}

/**
 * The page's own favicon, read from its origin. Falls back to a globe when the site has none, or when the
 * URL is not http(s).
 */
export function PageFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const origin = originOf(url);
  if (!origin || failed) {
    return <GlobeIcon aria-label="Page" className="size-3.5 text-muted-foreground" />;
  }
  // A favicon from an arbitrary site: next/image cannot optimize it, so a plain img is used.
  return <img src={`${origin}/favicon.ico`} alt="" width={14} height={14} className="size-3.5 rounded-sm" onError={() => setFailed(true)} />;
}

/** The text of an MCP result: the `text` parts of its content, joined. */
function resultText(result: unknown): string {
  if (typeof result === "string") return result;
  if (typeof result !== "object" || result === null) return "";
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "object" && part !== null && "text" in part ? String(part.text) : ""))
    .filter(Boolean)
    .join("\n");
}

/** Exa's fetch output starts each page with its title as a markdown heading: "# Title". */
function pageTitles(text: string): string[] {
  return [...text.matchAll(/^# (.+)$/gm)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

function hostOf(url: string | undefined): string | undefined {
  const origin = originOf(url);
  return origin ? new URL(origin).host : undefined;
}
