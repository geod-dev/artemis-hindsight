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
import { SettingsPage } from "./settings-page";

export function MemorySettings() {
  // Bumped when the memory changes (cleared, or a memory forgotten), so every tab loads again.
  const [version, setVersion] = useState(0);
  const changed = () => setVersion((value) => value + 1);

  return (
    <SettingsPage
      title="Memory"
      description="What Artemis remembers about you. Open any memory to see where it comes from."
      actions={<ClearMemoryButton onCleared={changed} />}
      fill
    >
      <MemoryExplorer version={version} onChanged={changed} />
    </SettingsPage>
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
        <Button variant="outline-destructive">
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
