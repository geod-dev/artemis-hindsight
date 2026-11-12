"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MemoryGraph = dynamic(() => import("./memory-graph").then((m) => m.MemoryGraph), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

export function MemorySettings() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <p className="text-sm text-muted-foreground">What Artemis remembers about you, as a graph.</p>
      </header>
      <div className="relative min-h-[60svh] flex-1 overflow-hidden rounded-xl border bg-card">
        <MemoryGraph />
      </div>
    </div>
  );
}
