"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EntityDetailView } from "./entity-detail";
import { MemoryDetailView } from "./memory-detail";
import { MentalModelDetailView } from "./mental-model-detail";

/** What the dialog shows. Opening a source, an entity or a piece of evidence pushes a new target on the stack. */
export type DetailTarget =
  | { kind: "memory"; id: string }
  | { kind: "entity"; id: string }
  | { kind: "mental_model"; id: string };

export interface DetailNavigation {
  /** Shows another memory, entity or mental model; Back returns here. */
  open: (target: DetailTarget) => void;
  /** Leaves this target: back to the previous one, or closes the dialog. */
  leave: () => void;
  /** The memory changed (a memory was deleted): the explorer reads its data again. */
  changed: () => void;
}

export function DetailDialog({
  stack,
  onStackChange,
  onChanged,
}: {
  stack: DetailTarget[];
  onStackChange: (stack: DetailTarget[]) => void;
  onChanged: () => void;
}) {
  const current = stack.at(-1);
  const navigation: DetailNavigation = {
    open: (target) => {
      if (current && current.kind === target.kind && current.id === target.id) return;
      onStackChange([...stack, target]);
    },
    leave: () => onStackChange(stack.slice(0, -1)),
    changed: onChanged,
  };

  return (
    <Dialog open={current !== undefined} onOpenChange={(open) => !open && onStackChange([])}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        {stack.length > 1 && (
          <div className="flex items-center px-3 pt-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={navigation.leave}>
              <ArrowLeft />
              Back
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Keyed by target, so each view starts fresh: its own load, its own delete confirmation. */}
          {current?.kind === "memory" && <MemoryDetailView key={`m:${current.id}`} id={current.id} navigation={navigation} />}
          {current?.kind === "entity" && <EntityDetailView key={`e:${current.id}`} id={current.id} navigation={navigation} />}
          {current?.kind === "mental_model" && (
            <MentalModelDetailView key={`mm:${current.id}`} id={current.id} navigation={navigation} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
