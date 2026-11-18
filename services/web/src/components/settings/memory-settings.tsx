"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MemoryExplorer } from "./memory/memory-explorer";

export function MemorySettings() {
  // Bumped when the memory changes (cleared, or a memory forgotten), so every tab loads again.
  const [version, setVersion] = useState(0);
  const changed = () => setVersion((value) => value + 1);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
          <p className="text-sm text-muted-foreground">
            What Artemis remembers about you. Open any memory to see where it comes from.
          </p>
        </div>
        <ClearMemoryButton onCleared={changed} />
      </header>
      <MemoryExplorer version={version} onChanged={changed} />
    </div>
  );
}

function ClearMemoryButton({ onCleared }: { onCleared: () => void }) {
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    setClearing(true);
    setError(null);
    try {
      const res = await fetch("/api/memory", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      onCleared();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setClearing(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (clearing) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 />
          Clear memory
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear your whole memory?</AlertDialogTitle>
          <AlertDialogDescription>
            Artemis will forget everything it remembers about you. Your conversations stay, but what was learned from
            them is erased. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">The memory could not be cleared: {error}.</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={clearing}
            onClick={(event) => {
              event.preventDefault();
              void clear();
            }}
          >
            {clearing ? "Clearing…" : "Clear memory"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
