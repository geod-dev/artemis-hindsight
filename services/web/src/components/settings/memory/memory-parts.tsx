"use client";

import { Check, ChevronRight, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { MemoryRef } from "@/lib/memory-explorer";
import { cn } from "@/lib/utils";
import { ENTITY_TOKEN, memoryHeadline, TYPE_STYLE, type RefType } from "./memory-style";

// Small pieces shared by the explorer's lists and detail dialogs.

export function ColorDot({ token, className }: { token: string; className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} style={{ backgroundColor: `var(${token})` }} />;
}

/** The kind of a memory, as a tinted pill. */
export function TypeTag({ type }: { type: RefType | "entity" }) {
  const token = type === "entity" ? ENTITY_TOKEN : TYPE_STYLE[type].token;
  const label = type === "entity" ? "Entity" : TYPE_STYLE[type].label;
  return (
    <Badge
      variant="outline"
      className="rounded-full border-transparent"
      style={{ color: `var(${token})`, backgroundColor: `color-mix(in oklab, var(${token}) 14%, transparent)` }}
    >
      <ColorDot token={token} className="size-1.5" />
      {label}
    </Badge>
  );
}

/** A titled block of a detail dialog. */
export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        {title}
        {count !== undefined && <span className="ml-1.5 tabular-nums">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Label and value pairs. Rows whose value is empty are left out. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  const shown = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
      {shown.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A memory or mental model another one points to. Opens it. */
export function RefRow({ item, onOpen, badge }: { item: MemoryRef; onOpen: (item: MemoryRef) => void; badge?: ReactNode }) {
  return (
    <Button
      variant="ghost"
      onClick={() => onOpen(item)}
      className="group h-auto w-full items-start justify-start gap-2.5 px-2.5 py-2 text-left font-normal whitespace-normal"
    >
      <ColorDot token={TYPE_STYLE[item.type].token} className="mt-1.5" />
      <span className="line-clamp-2 min-w-0 flex-1 leading-relaxed">{memoryHeadline(item.text)}</span>
      {badge}
      <ChevronRight className="mt-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </Button>
  );
}

export function RefList({ items, onOpen }: { items: readonly MemoryRef[]; onOpen: (item: MemoryRef) => void }) {
  return (
    <div className="-mx-2.5 flex flex-col">
      {items.map((item) => (
        <RefRow key={`${item.type}:${item.id}`} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}

export function CopyValue({ value, label = "Copy" }: { value: string; label?: string }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-xs text-muted-foreground">{value}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        onClick={() => copyToClipboard(value)}
        aria-label={isCopied ? "Copied" : label}
      >
        {isCopied ? <Check /> : <Copy />}
      </Button>
    </span>
  );
}

/** The placeholder of a detail dialog while it loads. */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/** A centered message inside a panel or dialog: empty, failed. */
export function PanelMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
