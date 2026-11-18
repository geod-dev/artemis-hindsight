"use client";

import { List, Network } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MemorySummary, MemoryType } from "@/lib/memory-explorer";
import { oneOf, useStoredState } from "@/lib/use-stored-state";
import { DetailDialog, type DetailTarget } from "./detail-dialog";
import { EntityPanel } from "./entity-panel";
import type { ExplorerView } from "./explorer-layout";
import { MemoryPanel } from "./memory-panel";
import { MentalModelPanel } from "./mental-model-panel";
import { useJson } from "./use-json";

type TabId = MemoryType | "entities" | "mental_models";

const TABS: { id: TabId; label: string; count: keyof MemorySummary }[] = [
  { id: "observation", label: "Observations", count: "observation" },
  { id: "world", label: "World facts", count: "world" },
  { id: "experience", label: "Experiences", count: "experience" },
  { id: "entities", label: "Entities", count: "entities" },
  { id: "mental_models", label: "Mental models", count: "mentalModels" },
];

const TAB_IDS = TABS.map((item) => item.id);
const VIEWS: readonly ExplorerView[] = ["graph", "list"];
const parseTab = oneOf(TAB_IDS);
const parseView = oneOf(VIEWS);

/**
 * The memory settings' explorer: one tab per kind of memory, each as a graph or a list. Clicking a node or a row opens
 * the detail dialog. Every tab reads its data again when `version` changes; `onChanged` asks for that after a memory
 * is forgotten.
 *
 * The open tab, and each tab's view and filters, are remembered in this browser: they survive a tab change and a reload.
 */
export function MemoryExplorer({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [tab, setTab] = useStoredState<TabId>("artemis.memory.tab", "observation", parseTab);
  const [view, setView] = useStoredState<ExplorerView>(`artemis.memory.${tab}.view`, "graph", parseView);
  const [stack, setStack] = useState<DetailTarget[]>([]);
  const summary = useJson<MemorySummary>("/api/memory/summary", version);

  const open = (target: DetailTarget) => setStack([target]);
  const panelProps = { view, version, onOpen: open };

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = parseTab(value);
          if (next) setTab(next);
        }}
        className="min-h-0 flex-1 gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto">
            <TabsList>
              {TABS.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="px-3">
                  {item.label}
                  {summary.status === "ready" && (
                    <span className="text-xs text-muted-foreground tabular-nums">{summary.data[item.count]}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              // Radix sends "" when the selected item is clicked again: the view stays as it is.
              const next = parseView(value);
              if (next) setView(next);
            }}
            aria-label="View"
          >
            <ToggleGroupItem value="graph" aria-label="Graph">
              <Network />
              Graph
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List">
              <List />
              List
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {(["observation", "world", "experience"] as const).map((type) => (
          <TabsContent key={type} value={type} className="flex min-h-0 flex-col gap-3">
            <MemoryPanel type={type} {...panelProps} />
          </TabsContent>
        ))}
        <TabsContent value="entities" className="flex min-h-0 flex-col gap-3">
          <EntityPanel {...panelProps} />
        </TabsContent>
        <TabsContent value="mental_models" className="flex min-h-0 flex-col gap-3">
          <MentalModelPanel {...panelProps} />
        </TabsContent>
      </Tabs>

      <DetailDialog stack={stack} onStackChange={setStack} onChanged={onChanged} />
    </>
  );
}
