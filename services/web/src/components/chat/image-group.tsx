"use client";

import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { useEffect, useState, type FC } from "react";
import { z } from "zod";
import { ImageGallery, type GalleryImage } from "@/components/assistant-ui/elements/image-gallery";
import { cn } from "@/lib/utils";
import { ASPECT_RATIOS, columnsFor, columnsStyle, SkeletonRow, useRowWidth, type AspectRatio } from "./image-row";
import { ErrorCard, useFenceClosed } from "./visual-block";

// An image group is a row of image search results the agent puts in its reply, written as a code block:
//
//   ```visual__image_group
//   { "query": ["Claude AI avatar", "ChatGPT avatar"], "num_per_query": 1, "aspect_ratio": "1:1" }
//   ```

/** The code block language of an image group. */
export const IMAGE_GROUP_LANGUAGE = "visual__image_group";

/** The most images one query can bring: the server stores 8 results per query and answers 400 above. */
const MAX_PER_QUERY = 8;

/** The most queries a group can have. The server answers 400 above. */
const MAX_QUERIES = 8;

const imageGroupSchema = z.object({
  query: z.union([z.string(), z.array(z.string())]),
  num_per_query: z.number().int().min(1).max(MAX_PER_QUERY).default(1),
  aspect_ratio: z.enum(ASPECT_RATIOS).optional(),
  /** Accepted too: the model may write it in camelCase. */
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
});

interface ImageGroupSpec {
  queries: string[];
  perQuery: number;
}

/** What /api/image-search answers for each result. */
interface ImageResult {
  thumbnailUrl: string;
  imageUrl: string;
  pageUrl: string | null;
  title: string;
  source: string;
}

type ParsedGroup =
  | { status: "complete"; spec: ImageGroupSpec; aspectRatio: AspectRatio }
  | { status: "invalid"; reason: string };

function parseGroup(json: string): ParsedGroup {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { status: "invalid", reason: "its JSON does not parse" };
  }
  const parsed = imageGroupSchema.safeParse(value);
  if (!parsed.success) return { status: "invalid", reason: `it needs a query, a num_per_query from 1 to ${MAX_PER_QUERY} and an aspect_ratio among ${ASPECT_RATIOS.join(", ")}` };
  const queries = [
    ...new Set((Array.isArray(parsed.data.query) ? parsed.data.query : [parsed.data.query]).map((q) => q.trim())),
  ].filter((query) => query !== "");
  if (queries.length === 0) return { status: "invalid", reason: "it has no query" };
  if (queries.length > MAX_QUERIES) return { status: "invalid", reason: `it has more than ${MAX_QUERIES} queries` };
  return {
    status: "complete",
    spec: { queries, perQuery: parsed.data.num_per_query },
    aspectRatio: parsed.data.aspect_ratio ?? parsed.data.aspectRatio ?? "1:1",
  };
}

/**
 * The gallery shows Brave's proxied thumbnail, in the row and in the viewer: it always loads, while the full image on
 * its origin site is sometimes refused to other sites (hotlink protection), which would show as a broken tile.
 */
const toGalleryImage = (result: ImageResult, index: number): GalleryImage => ({
  id: `${index}`,
  src: result.thumbnailUrl,
  alt: result.title || "Image result",
  caption: result.title || undefined,
  source: { label: result.source || "Source", url: result.pageUrl ?? result.imageUrl },
});

class ImageSearchError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function fetchImages(
  { queries, perQuery }: ImageGroupSpec,
  aspectRatio: AspectRatio,
  signal: AbortSignal,
): Promise<ImageResult[]> {
  const params = new URLSearchParams(queries.map((query) => ["q", query]));
  params.set("n", String(perQuery));
  // The server picks, for each image, the result whose shape best fits the tiles.
  params.set("r", aspectRatio);
  const res = await fetch(`/api/image-search?${params}`, { signal });
  if (res.ok) return ((await res.json()) as { results: ImageResult[] }).results;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new ImageSearchError(body?.error ?? `HTTP ${res.status}`, res.status !== 503 && res.status !== 400);
}

// The registry gallery lays its tiles in a grid of two or three columns. An image group is one row across the full
// content width: the gallery's grid (its first child) gets the row's columns (see image-row.tsx), and the tiles stretch
// to fill them. The gallery's own "+N" tile (its last visible tile, past maxVisible) stands for the
// rest. The classes target the gallery's markup from outside, so the downloaded component stays untouched. The column
// count goes through the --columns variable, set on the wrapper.
const ONE_ROW =
  "max-w-full [&>div:first-child]:grid-cols-[repeat(var(--columns),minmax(0,1fr))] [&>div:first-child]:gap-2";

// The gallery covers its last visible tile with a dark "+N" overlay. Here it becomes a small bubble in the tile's
// bottom-right corner, so the image stays visible. The overlay is the only absolutely positioned span in a tile.
const PLUS_BUBBLE =
  "[&>div:first-child>button>span.absolute]:top-auto [&>div:first-child>button>span.absolute]:left-auto [&>div:first-child>button>span.absolute]:right-2 [&>div:first-child>button>span.absolute]:bottom-2 [&>div:first-child>button>span.absolute]:rounded-full [&>div:first-child>button>span.absolute]:bg-black/70 [&>div:first-child>button>span.absolute]:px-2.5 [&>div:first-child>button>span.absolute]:py-0.5 [&>div:first-child>button>span.absolute]:text-sm [&>div:first-child>button>span.absolute]:font-semibold [&>div:first-child>button>span.absolute]:text-white [&>div:first-child>button>span.absolute]:shadow-md [&>div:first-child>button>span.absolute]:backdrop-blur-sm";

/** Each ratio's tile shape on the gallery's tiles, as full class names so Tailwind generates them. */
const GALLERY_TILE: Record<AspectRatio, string> = {
  "1:1": "[&>div:first-child>button]:aspect-square",
  "5:4": "[&>div:first-child>button]:aspect-[5/4]",
  "16:9": "[&>div:first-child>button]:aspect-video",
};

type State =
  | { status: "loading" }
  | { status: "ready"; images: GalleryImage[] }
  /** `retryable` is false when trying again would fail the same way (search not configured, invalid group). */
  | { status: "failed"; message: string; retryable: boolean };

/** One complete image group: searches its queries and shows the results in one row. */
const ImageGroup: FC<{ spec: ImageGroupSpec; aspectRatio: AspectRatio }> = ({ spec, aspectRatio }) => {
  const label = spec.queries.join(", ");
  // Joined strings, so the effect reruns only when the group changes, not on every render.
  const queryKey = spec.queries.join("\n");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchImages({ queries: queryKey.split("\n"), perQuery: spec.perQuery }, aspectRatio, controller.signal)
      .then((results) => setState({ status: "ready", images: results.map(toGalleryImage) }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : "image search failed",
          retryable: error instanceof ImageSearchError ? error.retryable : true,
        });
      });
    return () => controller.abort();
  }, [queryKey, spec.perQuery, aspectRatio, attempt]);

  if (state.status === "loading") {
    return (
      <SkeletonRow count={spec.queries.length * spec.perQuery} aspectRatio={aspectRatio} label={`Loading images: ${label}`} />
    );
  }
  if (state.status === "failed") {
    return (
      <ErrorCard
        title={`Images unavailable: ${label}`}
        message={`The image search failed (${state.message}).`}
        onRetry={state.retryable ? () => setAttempt((n) => n + 1) : undefined}
      />
    );
  }
  return <ImageRow images={state.images} aspectRatio={aspectRatio} label={label} />;
};

/** The results in one row: the tiles that fit, the last one a "+N" tile when some are left out. */
const ImageRow: FC<{ images: GalleryImage[]; aspectRatio: AspectRatio; label: string }> = ({
  images,
  aspectRatio,
  label,
}) => {
  const [ref, width] = useRowWidth();
  const columns = width === null ? images.length : columnsFor(width, aspectRatio);
  return (
    <div ref={ref} className="my-3 w-full first:mt-0" style={columnsStyle(columns)}>
      <ImageGallery
        images={images}
        maxVisible={columns}
        className={cn(ONE_ROW, PLUS_BUBBLE, GALLERY_TILE[aspectRatio])}
        aria-label={`Images: ${label}`}
      />
    </div>
  );
};

/**
 * Renders a ```visual__image_group code block as a row of images. While the block streams, a placeholder row stands in
 * for it; a closed block that is not valid shows an error card.
 */
const ImageGroupBlock: FC<SyntaxHighlighterProps> = ({ code }) => {
  const closed = useFenceClosed(IMAGE_GROUP_LANGUAGE, code);
  if (!closed) return <SkeletonRow count={8} aspectRatio="1:1" label="Loading images" />;
  const group = parseGroup(code);
  if (group.status === "complete") return <ImageGroup spec={group.spec} aspectRatio={group.aspectRatio} />;
  return <ErrorCard title="Images unavailable" message={`The image group is malformed: ${group.reason}.`} />;
};

export const imageGroupBlock = ImageGroupBlock;
