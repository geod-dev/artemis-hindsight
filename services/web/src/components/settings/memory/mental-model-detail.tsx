"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MemoryRef, MentalModelDetail } from "@/lib/memory-explorer";
import type { DetailNavigation } from "./detail-dialog";
import { MemoryMarkdown } from "./memory-markdown";
import { CopyValue, DetailSkeleton, Facts, PanelMessage, RefList, Section, TypeTag } from "./memory-parts";
import { formatDateTime, TYPE_STYLE, type RefType } from "./memory-style";
import { ShowMore } from "./show-more";
import { useJson } from "./use-json";

const EVIDENCE_ORDER: RefType[] = ["observation", "world", "experience", "mental_model"];

/** How a model is kept up to date, in words. */
function refreshPolicy(model: MentalModelDetail): string {
  const mode = model.refreshMode === "delta" ? "Edited in place" : model.refreshMode === "full" ? "Rewritten" : null;
  const when = model.refreshAfterConsolidation
    ? "after each consolidation"
    : model.refreshCron
      ? `on the schedule ${model.refreshCron} (UTC)`
      : "on demand";
  return mode ? `${mode}, ${when}` : when.charAt(0).toUpperCase() + when.slice(1);
}

/** One mental model: its content, how it is kept up to date, what it was built from and its earlier versions. */
export function MentalModelDetailView({ id, navigation }: { id: string; navigation: DetailNavigation }) {
  const state = useJson<MentalModelDetail>(`/api/memory/mental-models/${encodeURIComponent(id)}`);

  if (state.status === "loading") {
    return (
      <>
        <DialogTitle className="sr-only">Loading mental model</DialogTitle>
        <DetailSkeleton />
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
        <DialogTitle className="sr-only">Mental model</DialogTitle>
        <PanelMessage>This mental model could not be loaded: {state.message}.</PanelMessage>
      </>
    );
  }

  const model = state.data;
  const openRef = (ref: MemoryRef) =>
    navigation.open(ref.type === "mental_model" ? { kind: "mental_model", id: ref.id } : { kind: "memory", id: ref.id });
  const groups = EVIDENCE_ORDER.map((type) => ({ type, items: model.evidence.filter((ref) => ref.type === type) })).filter(
    (group) => group.items.length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <DialogHeader className="gap-3 pr-6 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type="mental_model" />
          {model.stale && <Badge variant="outline">New memories since the last refresh</Badge>}
          {model.refreshFailedAt && (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              Last refresh failed
            </Badge>
          )}
        </div>
        <DialogTitle className="text-lg font-semibold">{model.name}</DialogTitle>
        {model.sourceQuery && <DialogDescription className="leading-relaxed">{model.sourceQuery}</DialogDescription>}
      </DialogHeader>

      <div className="rounded-xl border bg-muted/30 p-4">
        {model.content ? (
          <MemoryMarkdown>{model.content}</MemoryMarkdown>
        ) : (
          <p className="text-sm text-muted-foreground">Not written yet. It is written after the next consolidation.</p>
        )}
      </div>

      <Section title="Details">
        <Facts
          rows={[
            { label: "Last refreshed", value: formatDateTime(model.lastRefreshedAt) },
            { label: "Last full rewrite", value: formatDateTime(model.lastFullRefreshAt) },
            { label: "Last refresh failed", value: formatDateTime(model.refreshFailedAt) },
            { label: "Created", value: formatDateTime(model.createdAt) },
            { label: "Refresh", value: refreshPolicy(model) },
            { label: "ID", value: <CopyValue value={model.id} label="Copy mental model id" /> },
          ]}
        />
      </Section>

      {groups.length > 0 && (
        <Section title="Built from" count={model.evidence.length}>
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.type} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">
                  {TYPE_STYLE[group.type].plural} <span className="tabular-nums">{group.items.length}</span>
                </p>
                <ShowMore items={group.items} initial={5} render={(shown) => <RefList items={shown} onOpen={openRef} />} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {model.history.length > 0 && (
        <Section title="Earlier versions" count={model.history.length}>
          <div className="flex flex-col gap-2">
            {model.history.map((version) => (
              <Collapsible key={version.changedAt} className="rounded-xl border">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="group w-full justify-start rounded-xl px-4 font-normal">
                    <ChevronRight className="text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                    Replaced {formatDateTime(version.changedAt)}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t px-4 py-3">
                  <MemoryMarkdown>{version.previousContent}</MemoryMarkdown>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
