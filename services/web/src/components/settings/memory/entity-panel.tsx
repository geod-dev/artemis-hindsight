"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EntityList } from "@/lib/memory-explorer";
import type { DetailTarget } from "./detail-dialog";
import { ExplorerGraph, ExplorerSurface, SearchField, type ExplorerView } from "./explorer-layout";
import { ColorDot, PanelMessage } from "./memory-parts";
import { ENTITY_TOKEN, formatDay } from "./memory-style";
import { useJson } from "./use-json";

/** The people, places and things the memory mentions: who appears with whom, or a table by mentions. */
export function EntityPanel({
  view,
  version,
  onOpen,
}: {
  view: ExplorerView;
  version: number;
  onOpen: (target: DetailTarget) => void;
}) {
  const state = useJson<EntityList>("/api/memory/entities", version);
  const [query, setQuery] = useState("");
  const data = state.status === "ready" ? state.data : null;

  const nodes = useMemo(
    () =>
      (data?.items ?? []).map((entity) => ({
        id: entity.id,
        label: entity.name,
        title: `${entity.name} · ${entity.mentions} ${entity.mentions === 1 ? "mention" : "mentions"}`,
        colorToken: ENTITY_TOKEN,
        size: 3 + Math.sqrt(entity.mentions) * 1.4,
      })),
    [data],
  );
  const links = useMemo(
    () =>
      (data?.links ?? []).map((link) => ({
        source: link.source,
        target: link.target,
        colorToken: "--muted-foreground",
        width: Math.min(0.5 + Math.log2(link.weight + 1) * 0.6, 2.5),
      })),
    [data],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.items ?? [])
      .filter((entity) => !needle || entity.name.toLowerCase().includes(needle))
      .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
  }, [data, query]);

  const open = (id: string) => onOpen({ kind: "entity", id });

  return (
    <>
      {data && data.items.length > 0 && (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
          {view === "list" ? (
            <SearchField value={query} onChange={setQuery} placeholder="Search entities" />
          ) : (
            <p className="text-sm text-muted-foreground">
              A line joins two entities mentioned in the same memory. The thicker, the more often.
            </p>
          )}
        </div>
      )}

      <ExplorerSurface scroll={view === "list"}>
        {state.status === "loading" && <ExplorerSurface.Loading view={view} />}
        {state.status === "error" && <PanelMessage>Entities could not be loaded: {state.message}.</PanelMessage>}
        {data && data.items.length === 0 && (
          <PanelMessage>No entities yet. People, places and things show up here once Artemis remembers them.</PanelMessage>
        )}
        {data && data.items.length > 0 && view === "graph" && <ExplorerGraph nodes={nodes} links={links} onSelect={open} />}
        {data && data.items.length > 0 && view === "list" && rows.length === 0 && (
          <PanelMessage>Nothing matches “{query.trim()}”.</PanelMessage>
        )}
        {data && data.items.length > 0 && view === "list" && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Entity</TableHead>
                <TableHead className="text-right">Mentions</TableHead>
                <TableHead className="pr-4 text-right">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entity) => (
                <TableRow key={entity.id} className="cursor-pointer" onClick={() => open(entity.id)}>
                  <TableCell className="pl-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="font-normal"
                      onClick={(event) => {
                        event.stopPropagation();
                        open(entity.id);
                      }}
                    >
                      <ColorDot token={ENTITY_TOKEN} />
                      {entity.name}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{entity.mentions}</TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground">{formatDay(entity.lastSeen)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ExplorerSurface>
    </>
  );
}
