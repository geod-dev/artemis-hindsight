"use client";

import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { WorkflowIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState, type FC } from "react";
import { Diagram } from "@/components/assistant-ui/elements/diagram";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ErrorCard, useFenceClosed, VisualSkeleton } from "./visual-block";

// A ```visual__diagram (or plain ```mermaid) code block holding Mermaid, drawn by Mermaid inside the registry's Diagram frame (title, zoom, full screen). The title is
// the diagram's own front matter title, if it has one:
//
//   ```visual__diagram
//   ---
//   title: Login flow
//   ---
//   flowchart LR
//     A[Browser] --> B[Server]
//   ```

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

const FRONT_MATTER = /^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n/;

/** The front matter title, and the diagram without it: the frame shows the title, so Mermaid does not draw it too. */
function splitTitle(code: string): { title: string; source: string } {
  const match = FRONT_MATTER.exec(code);
  if (!match) return { title: "Diagram", source: code };
  const title = /^title:\s*(.+)$/m.exec(match[1] ?? "")?.[1]?.trim().replace(/^["']|["']$/g, "");
  const rest = (match[1] ?? "").replace(/^title:.*$/m, "").trim();
  const source = rest ? `---\n${rest}\n---\n${code.slice(match[0].length)}` : code.slice(match[0].length);
  return { title: title || "Diagram", source };
}

type Rendered = { status: "loading" } | { status: "ready"; svg: string } | { status: "failed"; reason: string };

/** Draws the diagram with Mermaid, loaded on first use (it is large). Redrawn when the theme changes. */
function useMermaidSvg(source: string, enabled: boolean): Rendered {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const { resolvedTheme } = useTheme();
  const [rendered, setRendered] = useState<Rendered>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        // "strict" keeps scripts and click handlers out of the drawn SVG.
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });
        const { svg } = await mermaid.render(id, source);
        if (!cancelled) setRendered({ status: "ready", svg });
      } catch (error) {
        if (!cancelled) {
          setRendered({ status: "failed", reason: error instanceof Error ? error.message.split("\n")[0]! : "it does not parse" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, source, enabled, resolvedTheme]);

  return rendered;
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The diagram block for a code block language: its fence is looked up under that language. */
export const mermaidBlock = (language: string): FC<SyntaxHighlighterProps> => {
  const MermaidBlock: FC<SyntaxHighlighterProps> = ({ code }) => <MermaidDiagram language={language} code={code} />;
  return MermaidBlock;
};

const MermaidDiagram: FC<{ language: string; code: string }> = ({ language, code }) => {
  const closed = useFenceClosed(language, code);
  const { title, source } = splitTitle(code);
  const rendered = useMermaidSvg(source, closed);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);

  if (!closed || rendered.status === "loading") return <VisualSkeleton className="h-56" label="Loading diagram" />;
  if (rendered.status === "failed") {
    return <ErrorCard icon={WorkflowIcon} title="Diagram unavailable" message={`The diagram is malformed: ${rendered.reason}`} />;
  }

  // Mermaid's SVG, drawn with securityLevel "strict". Mermaid caps it at its natural width with an inline max-width,
  // which leaves small diagrams small: the cap is lifted (max-w-none!) so the drawing scales up to the frame's width,
  // and max-h keeps a tall flowchart from growing past the screen. The SVG keeps its proportions inside both.
  const svg = (
    <div
      className="w-full [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[32rem] [&_svg]:w-full [&_svg]:max-w-none!"
      dangerouslySetInnerHTML={{ __html: rendered.svg }}
    />
  );
  return (
    <>
      <Diagram
        // The zoom wrapper (the body's only child) would shrink to its content: it takes the frame's width instead.
        className="my-3 max-w-full first:mt-0 [&>div:last-child>div]:w-full"
        title={title}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
        onZoomOut={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
        onReset={() => setZoom(1)}
        onExpand={() => setExpanded(true)}
      >
        {svg}
      </Diagram>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-[min(72rem,calc(100%-2rem))]">
          <DialogTitle>{title}</DialogTitle>
          <div
            className="[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[80vh] [&_svg]:w-full [&_svg]:max-w-none!"
            dangerouslySetInnerHTML={{ __html: rendered.svg }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

