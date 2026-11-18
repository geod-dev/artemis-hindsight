"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The layout pieces every tab of the memory explorer shares.

export type ExplorerView = "graph" | "list";

/** The force graph needs the browser: it is loaded on the client only, when a graph is first shown. */
export const ExplorerGraph = dynamic(() => import("./graph-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="absolute inset-0 rounded-none" />,
});

/** The bordered area under the toolbar: the graph fills it, the list scrolls in it. */
export function ExplorerSurface({ scroll, children }: { scroll: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative min-h-[60svh] flex-1 rounded-xl border bg-card",
        scroll ? "overflow-y-auto" : "overflow-hidden",
      )}
    >
      {children}
    </div>
  );
}

ExplorerSurface.Loading = function ExplorerLoading({ view }: { view: ExplorerView }) {
  if (view === "graph") return <Skeleton className="absolute inset-0 rounded-none" />;
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
};

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 pl-8"
      />
    </div>
  );
}
