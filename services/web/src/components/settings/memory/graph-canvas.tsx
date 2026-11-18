"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";

// The force graph of the memory explorer, shared by every tab. Nodes and links are drawn here (not by the library's
// defaults) so the colors come from the theme, a hovered node dims what is not linked to it, and line widths stay
// the same at every zoom. Loaded with next/dynamic: the library needs the browser.

export interface GraphNodeInput {
  id: string;
  /** Drawn next to the node when zoomed in. Kept short. */
  label: string;
  /** Shown in the preview while the node is hovered. */
  title: string;
  /** A CSS color token, e.g. "--memory-world". */
  colorToken: string;
  /** Radius, in graph units. */
  size: number;
}

export interface GraphLinkInput {
  source: string;
  target: string;
  colorToken: string;
  /** On-screen width in pixels. */
  width: number;
}

export interface GraphCanvasProps {
  nodes: GraphNodeInput[];
  links: GraphLinkInput[];
  onSelect: (id: string) => void;
}

type Node = NodeObject<GraphNodeInput>;
type Link = LinkObject<GraphNodeInput, GraphLinkInput>;

const BASE_TOKENS = ["--foreground", "--muted-foreground", "--card"];

/** CSS tokens as plain colors: canvas reads neither CSS variables nor every color syntax. */
function resolveColors(tokens: string[]): Map<string, string> {
  const style = getComputedStyle(document.documentElement);
  const context = document.createElement("canvas").getContext("2d");
  const colors = new Map<string, string>();
  for (const token of tokens) {
    const raw = style.getPropertyValue(token).trim();
    if (context && raw) {
      context.fillStyle = "#000";
      context.fillStyle = raw;
      colors.set(token, String(context.fillStyle));
    } else {
      colors.set(token, raw || "#888");
    }
  }
  return colors;
}

/** A link end is an id until the simulation starts, then the node object itself. */
const endId = (end: unknown): string =>
  typeof end === "object" && end !== null && "id" in end ? String((end as { id: unknown }).id) : String(end);

export function GraphCanvas({ nodes, links, onSelect }: GraphCanvasProps) {
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const graph = useRef<ForceGraphMethods<Node, Link> | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tokens = useMemo(
    () => [...new Set([...BASE_TOKENS, ...nodes.map((node) => node.colorToken), ...links.map((link) => link.colorToken)])],
    [nodes, links],
  );
  const [colors, setColors] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    if (!resolvedTheme) return;
    setColors(resolveColors(tokens));
  }, [resolvedTheme, tokens]);

  // One object per node for the life of the data: the simulation keeps its position on it, so showing or hiding links
  // moves the graph from where it is instead of starting over.
  const nodeObjects = useMemo<Node[]>(() => nodes.map((node) => ({ ...node })), [nodes]);
  useEffect(() => {
    fitted.current = false;
  }, [nodeObjects]);
  const graphData = useMemo(
    () => ({ nodes: nodeObjects, links: links.map((link): Link => ({ ...link })) }),
    [nodeObjects, links],
  );

  const neighbors = useMemo(() => {
    if (!hovered) return null;
    const set = new Set([hovered]);
    for (const link of links) {
      if (link.source === hovered) set.add(link.target);
      if (link.target === hovered) set.add(link.source);
    }
    return set;
  }, [hovered, links]);

  useEffect(() => {
    const charge = graph.current?.d3Force("charge") as { strength?: (value: number) => unknown } | undefined;
    charge?.strength?.(-60);
  }, [graphData, size.width]);

  const hoveredNode = hovered ? nodes.find((node) => node.id === hovered) : undefined;
  const color = (token: string) => colors?.get(token) ?? "#888";

  return (
    <div ref={container} className="absolute inset-0">
      {colors && size.width > 0 && (
        <ForceGraph2D<GraphNodeInput, GraphLinkInput>
          ref={graph}
          width={size.width}
          height={size.height}
          graphData={graphData}
          nodeId="id"
          warmupTicks={40}
          cooldownTicks={150}
          onEngineStop={() => {
            if (fitted.current) return;
            fitted.current = true;
            graph.current?.zoomToFit(400, 48);
          }}
          enableNodeDrag
          onNodeHover={(node) => setHovered(node ? String(node.id) : null)}
          onNodeClick={(node) => onSelect(String(node.id))}
          linkCanvasObjectMode={() => "replace"}
          linkCanvasObject={(link, ctx, scale) => {
            const source = link.source as Node;
            const target = link.target as Node;
            if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;
            const touchesHovered = hovered !== null && (endId(link.source) === hovered || endId(link.target) === hovered);
            ctx.globalAlpha = hovered === null ? 0.45 : touchesHovered ? 0.95 : 0.06;
            ctx.strokeStyle = color(link.colorToken);
            ctx.lineWidth = (touchesHovered ? link.width + 0.5 : link.width) / scale;
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={(node, ctx, scale) => {
            if (node.x === undefined || node.y === undefined) return;
            const id = String(node.id);
            const dimmed = neighbors !== null && !neighbors.has(id);
            ctx.globalAlpha = dimmed ? 0.18 : 1;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
            ctx.fillStyle = color(node.colorToken);
            ctx.fill();
            if (id === hovered) {
              ctx.lineWidth = 2 / scale;
              ctx.strokeStyle = color("--foreground");
              ctx.stroke();
            }
            // Labels only where they can be read: the hovered node, or every visible node once zoomed in.
            const showLabel = id === hovered || (!dimmed && scale >= 2.4);
            if (showLabel && node.label) {
              const fontSize = 11 / scale;
              ctx.font = `${id === hovered ? 600 : 400} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = color(id === hovered ? "--foreground" : "--muted-foreground");
              ctx.fillText(node.label, node.x, node.y + node.size + 2 / scale);
            }
            ctx.globalAlpha = 1;
          }}
          nodePointerAreaPaint={(node, paint, ctx) => {
            if (node.x === undefined || node.y === undefined) return;
            ctx.fillStyle = paint;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.size + 2, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />
      )}
      {hoveredNode && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-md rounded-xl border bg-popover/95 px-3 py-2 text-sm text-popover-foreground shadow-md backdrop-blur">
          <p className="line-clamp-3 leading-relaxed">{hoveredNode.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">Click to open</p>
        </div>
      )}
    </div>
  );
}

export default GraphCanvas;
