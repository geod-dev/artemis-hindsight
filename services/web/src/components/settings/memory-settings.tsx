"use client";

import { Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
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
import { Skeleton } from "@/components/ui/skeleton";

const MemoryGraph = dynamic(() => import("./memory-graph").then((m) => m.MemoryGraph), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

export function MemorySettings() {
  // Bumped after the memory is cleared, so the graph loads again.
  const [graphVersion, setGraphVersion] = useState(0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
          <p className="text-sm text-muted-foreground">
            What Artemis remembers about you, as a graph. Click a memory to see it or delete it.
          </p>
        </div>
        <ClearMemoryButton onCleared={() => setGraphVersion((version) => version + 1)} />
      </header>
      <div className="relative min-h-[60svh] flex-1 overflow-hidden rounded-xl border bg-card">
        <MemoryGraph key={graphVersion} />
      </div>
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
