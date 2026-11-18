"use client";

import { useMemo } from "react";
import { someOf, useStoredState } from "@/lib/use-stored-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MentalModelItem } from "@/lib/memory-explorer";
import type { DetailTarget } from "./detail-dialog";
import { ExplorerGraph, ExplorerSurface, type ExplorerView } from "./explorer-layout";
import { ColorDot, PanelMessage } from "./memory-parts";
import { formatDateTime, memoryHeadline, plainText, TYPE_STYLE, type RefType } from "./memory-style";
import { useJson } from "./use-json";

const EVIDENCE_TYPES: RefType[] = ["observation", "world", "experience", "mental_model"];
const parseEvidence = someOf(EVIDENCE_TYPES);

/** The summaries memory keeps up to date: each linked to what it was built from, or as cards. */
export function MentalModelPanel({
  view,
  version,
  onOpen,
}: {
  view: ExplorerView;
  version: number;
  onOpen: (target: DetailTarget) => void;
}) {
  const state = useJson<MentalModelItem[]>("/api/memory/mental-models", version);
  const [shown, setShown] = useStoredState<RefType[]>("artemis.memory.mental_models.evidence", EVIDENCE_TYPES, parseEvidence);
  const models = state.status === "ready" ? state.data : null;

  // Distinct memories: one used by several models counts once.
  const evidenceCounts = useMemo(() => {
    const ids: Record<RefType, Set<string>> = {
      observation: new Set(),
      world: new Set(),
      experience: new Set(),
      mental_model: new Set(),
    };
    for (const model of models ?? []) for (const ref of model.evidence) ids[ref.type].add(ref.id);
    return Object.fromEntries(EVIDENCE_TYPES.map((type) => [type, ids[type].size])) as Record<RefType, number>;
  }, [models]);

  // Models are always drawn. A memory used by several models is one node linked to each of them.
  const graph = useMemo(() => {
    const modelIds = new Set((models ?? []).map((model) => model.id));
    const nodes = new Map<string, { id: string; label: string; title: string; colorToken: string; size: number }>();
    const links: { source: string; target: string; colorToken: string; width: number }[] = [];
    for (const model of models ?? []) {
      nodes.set(model.id, {
        id: model.id,
        label: model.name,
        title: model.name,
        colorToken: TYPE_STYLE.mental_model.token,
        size: 9,
      });
    }
    for (const model of models ?? []) {
      for (const ref of model.evidence) {
        if (!shown.includes(ref.type)) continue;
        if (ref.type === "mental_model" && !modelIds.has(ref.id)) continue;
        if (!nodes.has(ref.id)) {
          const headline = memoryHeadline(ref.text);
          nodes.set(ref.id, {
            id: ref.id,
            label: headline.length > 42 ? `${headline.slice(0, 40)}…` : headline,
            title: headline,
            colorToken: TYPE_STYLE[ref.type].token,
            size: 3.5,
          });
        }
        links.push({ source: model.id, target: ref.id, colorToken: TYPE_STYLE[ref.type].token, width: 0.7 });
      }
    }
    return { nodes: [...nodes.values()], links, modelIds };
  }, [models, shown]);

  const open = (id: string) =>
    onOpen(graph.modelIds.has(id) ? { kind: "mental_model", id } : { kind: "memory", id });

  return (
    <>
      {models && models.length > 0 && view === "graph" && (
        <div className="flex min-h-9 flex-wrap items-center gap-3">
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            spacing={2}
            value={shown}
            onValueChange={(value) => setShown(parseEvidence(value) ?? [])}
            aria-label="Evidence shown in the graph"
            className="flex-wrap"
          >
            {EVIDENCE_TYPES.map((type) => (
              <ToggleGroupItem
                key={type}
                value={type}
                disabled={evidenceCounts[type] === 0}
                className="gap-2 rounded-full data-[state=off]:text-muted-foreground"
              >
                <ColorDot token={TYPE_STYLE[type].token} />
                {TYPE_STYLE[type].plural}
                <span className="text-muted-foreground tabular-nums">{evidenceCounts[type]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <ExplorerSurface scroll={view === "list"}>
        {state.status === "loading" && <ExplorerSurface.Loading view={view} />}
        {state.status === "error" && <PanelMessage>Mental models could not be loaded: {state.message}.</PanelMessage>}
        {models && models.length === 0 && (
          <PanelMessage>No mental models yet. They are created with your memory and written after its first consolidation.</PanelMessage>
        )}
        {models && models.length > 0 && view === "graph" && (
          <ExplorerGraph nodes={graph.nodes} links={graph.links} onSelect={open} />
        )}
        {models && models.length > 0 && view === "list" && (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {models.map((model) => (
              <Button
                key={model.id}
                variant="outline"
                onClick={() => open(model.id)}
                className="h-auto flex-col items-start gap-2 rounded-xl p-4 text-left font-normal whitespace-normal"
              >
                <span className="flex w-full items-center gap-2">
                  <ColorDot token={TYPE_STYLE.mental_model.token} />
                  <span className="min-w-0 flex-1 truncate font-medium">{model.name}</span>
                  {model.refreshFailedAt ? (
                    <Badge variant="outline" className="border-destructive/40 text-destructive">
                      Refresh failed
                    </Badge>
                  ) : model.stale ? (
                    <Badge variant="outline">Out of date</Badge>
                  ) : null}
                </span>
                <span className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {model.content ? plainText(model.content) : "Not written yet."}
                </span>
                <span className="text-xs text-muted-foreground">
                  {model.lastRefreshedAt ? `Refreshed ${formatDateTime(model.lastRefreshedAt)}` : "Never refreshed"}
                  {" · "}
                  {model.evidence.length} {model.evidence.length === 1 ? "memory" : "memories"}
                </span>
              </Button>
            ))}
          </div>
        )}
      </ExplorerSurface>
    </>
  );
}
