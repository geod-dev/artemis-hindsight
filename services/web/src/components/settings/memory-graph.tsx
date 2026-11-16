"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface GraphNode {
  id: string;
  label: string;
  text: string;
  date: string;
  context: string;
  factType: string | null;
  color: string | null;
}

const FACT_TYPES: Record<string, { label: string; token: string }> = {
  world: { label: "Fact", token: "--memory-world" },
  experience: { label: "Experience", token: "--memory-experience" },
  observation: { label: "Observation", token: "--memory-observation" },
  mental_model: { label: "Mental model", token: "--memory-mental-model" },
};

function FactTypeTag({ factType }: { factType: string }) {
  const known = FACT_TYPES[factType];
  const color = known ? `var(${known.token})` : "var(--muted-foreground)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {known?.label ?? factType}
    </span>
  );
}

const memoryDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** "Nov 12, 2026, 4:20 PM" from the stored ISO time; the raw value if it does not parse. */
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : memoryDate.format(date);
}

// A tag is "Key: value" where the key is one or two words, e.g. "Involving: user" or "Where: Paris".
const TAG = /^(\p{L}+(?: \p{L}+)?):\s*(.*)$/u;

/**
 * "Sentence one | Involving: user | Sentence two" becomes the sentences, in order, and the tags.
 */
function splitMemory(text: string) {
  const sentences: string[] = [];
  const tags: { key: string; value: string }[] = [];
  for (const part of text.split(" | ")) {
    const match = part.trim().match(TAG);
    if (match?.[1] && match[2] !== undefined) tags.push({ key: match[1], value: match[2] });
    else if (part.trim()) sentences.push(part.trim());
  }
  return { sentences, tags };
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  weight: number;
  linkType: string;
  color: string | null;
}

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; nodes: GraphNode[]; links: GraphLink[] };

interface GraphColors {
  background: string;
  node: string;
  link: string;
}

/**
 * The page's tokens as plain colors. three.js cannot read oklch or CSS variables, so each token goes through a 2D
 * canvas, which hands back a normalized color string.
 */
function readGraphColors(): GraphColors {
  const style = getComputedStyle(document.documentElement);
  const context = document.createElement("canvas").getContext("2d");
  const plain = (token: string) => {
    const raw = style.getPropertyValue(token).trim();
    if (!context) return raw;
    context.fillStyle = raw;
    return context.fillStyle;
  };
  return {
    background: plain("--background"),
    node: plain("--primary"),
    link: plain("--muted-foreground"),
  };
}

export function MemoryGraph() {
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [colors, setColors] = useState<GraphColors | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!resolvedTheme) return;
    setColors(readGraphColors());
  }, [resolvedTheme]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/memory/graph", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body: unknown = await res.json();
        if (!res.ok) {
          const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : "";
          throw new Error(message || `HTTP ${res.status}`);
        }
        const graph = body as { nodes: GraphNode[]; edges: GraphLink[] };
        setLoad({ status: "ready", nodes: graph.nodes, links: graph.edges });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, []);

  /** Drops a deleted memory and its links from the graph. The graph library replaces link ends with node objects. */
  function removeNode(id: string) {
    const endId = (end: unknown) => (typeof end === "object" && end !== null ? (end as GraphNode).id : end);
    setLoad((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            nodes: current.nodes.filter((node) => node.id !== id),
            links: current.links.filter((link) => endId(link.source) !== id && endId(link.target) !== id),
          }
        : current,
    );
    setSelected(null);
  }

  return (
    <div ref={container} className="absolute inset-0">
      {load.status === "loading" && <Skeleton className="h-full w-full" />}

      {load.status === "error" && (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          The memory graph could not be loaded: {load.message}.
        </div>
      )}

      {load.status === "ready" && load.nodes.length === 0 && (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Nothing is remembered yet. Talk to Artemis, and what it keeps will show up here.
        </div>
      )}

      {load.status === "ready" && load.nodes.length > 0 && size.width > 0 && colors && (
        <>
          <ForceGraph3D
            width={size.width}
            height={size.height}
            graphData={{ nodes: load.nodes, links: load.links }}
            backgroundColor={colors.background}
            nodeId="id"
            nodeLabel={(node: object) => (node as GraphNode).text}
            nodeColor={(node: object) => (node as GraphNode).color ?? colors.node}
            nodeOpacity={0.9}
            linkColor={(link: object) => (link as GraphLink).color ?? colors.link}
            linkWidth={(link: object) => Math.min(3, (link as GraphLink).weight ?? 1)}
            linkOpacity={0.35}
            onNodeClick={(node: object) => setSelected(node as GraphNode)}
            onBackgroundClick={() => setSelected(null)}
          />
          {selected && <MemoryCard key={selected.id} node={selected} onDeleted={removeNode} />}
        </>
      )}
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(id)}
      className="cursor-pointer underline-offset-2 hover:underline"
    >
      {isCopied ? "Copied" : "Copy id"}
    </button>
  );
}

/** Facts can be deleted. Observations and mental models are derived from them, so they cannot be deleted one by one. */
const DELETABLE_TYPES = new Set(["world", "experience"]);

function DeleteMemory({ id, onDeleted }: { id: string; onDeleted: (id: string) => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setStep("deleting");
    setError(null);
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      onDeleted(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStep("confirm");
    }
  }

  if (step === "idle") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-destructive hover:text-destructive"
        onClick={() => setStep("confirm")}
      >
        <Trash2 />
        Delete
      </Button>
    );
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs text-muted-foreground">Artemis will forget this memory. This cannot be undone.</p>
      {error && <p className="text-xs text-destructive">It could not be deleted: {error}.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={step === "deleting"} onClick={() => setStep("idle")}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" disabled={step === "deleting"} onClick={() => void remove()}>
          {step === "deleting" ? "Deleting…" : "Delete memory"}
        </Button>
      </div>
    </div>
  );
}

function MemoryCard({ node, onDeleted }: { node: GraphNode; onDeleted: (id: string) => void }) {
  const { sentences, tags } = splitMemory(node.text || node.label);
  const deletable = node.factType !== null && DELETABLE_TYPES.has(node.factType);
  return (
    <aside className="absolute left-4 top-4 max-w-sm space-y-3 rounded-xl border bg-popover/95 p-4 text-sm text-popover-foreground shadow-lg backdrop-blur">
      {(node.factType || node.context) && (
        <div className="flex flex-wrap gap-1.5">
          {node.factType && <FactTypeTag factType={node.factType} />}
          {node.context && <Badge variant="outline">{node.context}</Badge>}
        </div>
      )}
      <div className="flex flex-col gap-1.5 leading-relaxed">
        {sentences.map((sentence, index) => (
          <p key={index}>{sentence}</p>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="font-normal">
              <span className="text-muted-foreground">{tag.key}:</span>
              {tag.value}
            </Badge>
          ))}
        </div>
      )}
      {(node.date || node.id) && (
        <p className="text-xs text-muted-foreground">
          {node.date && formatDate(node.date)}
          {node.date && node.id && " · "}
          {node.id && <CopyId id={node.id} />}
        </p>
      )}
      {deletable && <DeleteMemory id={node.id} onDeleted={onDeleted} />}
    </aside>
  );
}
