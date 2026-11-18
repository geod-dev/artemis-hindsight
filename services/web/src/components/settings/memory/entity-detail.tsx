"use client";

import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EntityDetail } from "@/lib/memory-explorer";
import type { DetailNavigation } from "./detail-dialog";
import { ColorDot, CopyValue, DetailSkeleton, Facts, PanelMessage, RefList, Section, TypeTag } from "./memory-parts";
import { ENTITY_TOKEN, formatDateTime } from "./memory-style";
import { ShowMore } from "./show-more";
import { useJson } from "./use-json";

/** One entity: how often it is mentioned, the memories that mention it, the entities it appears with. */
export function EntityDetailView({ id, navigation }: { id: string; navigation: DetailNavigation }) {
  const state = useJson<EntityDetail>(`/api/memory/entities/${encodeURIComponent(id)}`);

  if (state.status === "loading") {
    return (
      <>
        <DialogTitle className="sr-only">Loading entity</DialogTitle>
        <DetailSkeleton />
      </>
    );
  }
  if (state.status === "error") {
    return (
      <>
        <DialogTitle className="sr-only">Entity</DialogTitle>
        <PanelMessage>This entity could not be loaded: {state.message}.</PanelMessage>
      </>
    );
  }

  const entity = state.data;
  return (
    <div className="flex flex-col gap-6">
      <DialogHeader className="gap-3 pr-6 text-left">
        <div>
          <TypeTag type="entity" />
        </div>
        <DialogTitle className="text-lg font-semibold">{entity.name}</DialogTitle>
      </DialogHeader>

      <Section title="Details">
        <Facts
          rows={[
            { label: "Mentions", value: String(entity.mentions) },
            { label: "First seen", value: formatDateTime(entity.firstSeen) },
            { label: "Last seen", value: formatDateTime(entity.lastSeen) },
            { label: "ID", value: <CopyValue value={entity.id} label="Copy entity id" /> },
          ]}
        />
      </Section>

      {entity.related.length > 0 && (
        <Section title="Mentioned with" count={entity.related.length}>
          <ShowMore
            items={entity.related}
            initial={24}
            render={(shown) => (
              <div className="flex flex-wrap gap-1.5">
                {shown.map((other) => (
                  <Button
                    key={other.id}
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full px-2.5 font-normal"
                    onClick={() => navigation.open({ kind: "entity", id: other.id })}
                  >
                    <ColorDot token={ENTITY_TOKEN} className="size-1.5" />
                    {other.name}
                    <span className="text-muted-foreground tabular-nums">{other.weight}</span>
                  </Button>
                ))}
              </div>
            )}
          />
        </Section>
      )}

      <Section title="Memories" count={entity.memories.length}>
        {entity.memories.length > 0 ? (
          <ShowMore
            items={entity.memories}
            initial={8}
            render={(shown) => (
              <RefList items={shown} onOpen={(ref) => navigation.open({ kind: "memory", id: ref.id })} />
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No fact mentions this entity anymore.</p>
        )}
      </Section>
    </div>
  );
}
