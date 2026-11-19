"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LINK_TYPES, type LinkType, type MemoryItem, type MemoryList, type MemoryType } from "@/lib/memory-explorer";
import { someOf, useStoredState } from "@/lib/use-stored-state";
import type { DetailTarget } from "./detail-dialog";
import { ExplorerGraph, ExplorerSurface, SearchField, type ExplorerView } from "./explorer-layout";
import { ColorDot, PanelMessage } from "./memory-parts";
import { DEFAULT_LINKS, formatDay, LINK_STYLE, MEMORY_TYPE_EMPTY, memoryHeadline, TYPE_STYLE } from "./memory-style";
import { useJson } from "./use-json";

const LINK_WIDTH: Record<LinkType, number> = { semantic: 1.2, temporal: 0.6, entity: 0.6, causal: 1.8 };
const parseLinks = someOf(LINK_TYPES);

/** Observations, world facts or experiences: a graph of their links, or a searchable list. */
export function MemoryPanel({
  type,
  view,
  version,
  onOpen,
}: {
  type: MemoryType;
  view: ExplorerView;
  version: number;
  onOpen: (target: DetailTarget) => void;
}) {
  const state = useJson<MemoryList>(`/api/memory/memories?type=${type}`, version);
  const [shownLinks, setShownLinks] = useStoredState(`artemis.memory.${type}.links`, DEFAULT_LINKS, parseLinks);
  const [query, setQuery] = useState("");

  const data = state.status === "ready" ? state.data : null;
  const linkCounts = useMemo(() => {
    const counts: Record<LinkType, number> = { semantic: 0, temporal: 0, entity: 0, causal: 0 };
    for (const link of data?.links ?? []) counts[link.type] += 1;
    return counts;
  }, [data]);

  const nodes = useMemo(
    () =>
      (data?.items ?? []).map((item) => {
        const headline = memoryHeadline(item.text);
        return {
          id: item.id,
          label: headline.length > 42 ? `${headline.slice(0, 40)}…` : headline,
          title: headline,
          colorToken: TYPE_STYLE[type].token,
          size: item.proofCount && item.proofCount > 1 ? 4 + Math.min(item.proofCount, 8) * 0.6 : 4,
        };
      }),
    [data, type],
  );
  const links = useMemo(
    () =>
      (data?.links ?? [])
        .filter((link) => shownLinks.includes(link.type))
        .map((link) => ({
          source: link.source,
          target: link.target,
          colorToken: LINK_STYLE[link.type].token,
          width: LINK_WIDTH[link.type],
        })),
    [data, shownLinks],
  );

  const listed = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items = (data?.items ?? []).filter(
      (item) =>
        !needle ||
        item.text.toLowerCase().includes(needle) ||
        item.entities.some((entity) => entity.toLowerCase().includes(needle)),
    );
    return [...items].sort((a, b) => Date.parse(b.mentionedAt ?? "") - Date.parse(a.mentionedAt ?? "") || 0);
  }, [data, query]);

  const open = (id: string) => onOpen({ kind: "memory", id });

  return (
    <>
      {data && data.items.length > 0 && (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
          {view === "graph" ? (
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              spacing={2}
              value={shownLinks}
              onValueChange={(value) => setShownLinks(parseLinks(value) ?? [])}
              aria-label="Links shown in the graph"
              className="flex-wrap"
            >
              {LINK_TYPES.map((linkType) => (
                <ToggleGroupItem
                  key={linkType}
                  value={linkType}
                  title={LINK_STYLE[linkType].description}
                  disabled={linkCounts[linkType] === 0}
                  className="gap-2"
                >
                  <ColorDot token={LINK_STYLE[linkType].token} />
                  {LINK_STYLE[linkType].label}
                  <span className="text-muted-foreground tabular-nums">{linkCounts[linkType]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <SearchField value={query} onChange={setQuery} placeholder={`Search ${TYPE_STYLE[type].plural.toLowerCase()}`} />
          )}
          {data.total > data.items.length && (
            <p className="text-xs text-muted-foreground">
              Showing {data.items.length} of {data.total}
            </p>
          )}
        </div>
      )}

      <ExplorerSurface scroll={view === "list"}>
        {state.status === "loading" && <ExplorerSurface.Loading view={view} />}
        {state.status === "error" && <PanelMessage>Memory could not be loaded: {state.message}.</PanelMessage>}
        {data && data.items.length === 0 && <PanelMessage>{MEMORY_TYPE_EMPTY[type]}</PanelMessage>}
        {data && data.items.length > 0 && view === "graph" && <ExplorerGraph nodes={nodes} links={links} onSelect={open} />}
        {data && data.items.length > 0 && view === "list" && (
          <MemoryRows items={listed} query={query} onOpen={open} />
        )}
      </ExplorerSurface>
    </>
  );
}

function MemoryRows({ items, query, onOpen }: { items: MemoryItem[]; query: string; onOpen: (id: string) => void }) {
  if (items.length === 0) return <PanelMessage>Nothing matches “{query.trim()}”.</PanelMessage>;
  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => (
        <li key={item.id}>
          <Button
            variant="ghost"
            onClick={() => onOpen(item.id)}
            className="h-auto w-full flex-col items-start gap-1.5 rounded-none px-4 py-3 text-left font-normal whitespace-normal"
          >
            <span className="line-clamp-2 text-sm leading-relaxed">{memoryHeadline(item.text)}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {item.mentionedAt && <span>{formatDay(item.mentionedAt)}</span>}
              {item.proofCount !== null && item.proofCount > 0 && (
                <span>
                  {item.proofCount} {item.proofCount === 1 ? "source" : "sources"}
                </span>
              )}
              {item.entities.length > 0 && (
                <span className="truncate">
                  {item.entities.slice(0, 4).join(", ")}
                  {item.entities.length > 4 && ` +${item.entities.length - 4}`}
                </span>
              )}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
