"use client";

import { useCallback, useState, type CSSProperties, type FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The row of pictures shared by the image group and the product group: one row across the full width of the reply, as
// many tiles as fit (four for square tiles), with the same skeleton while it loads.

export const ASPECT_RATIOS = ["1:1", "5:4", "16:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

const TILE_HEIGHT_PX = 160;
const GAP_PX = 8; // gap-2
/** Square tiles always come four to a row, wide enough to show their content. */
const SQUARE_COLUMNS = 4;

/** Each ratio's tile shape, as full class names so Tailwind generates them, and the tile width at TILE_HEIGHT_PX. */
export const TILE_SHAPES: Record<AspectRatio, { className: string; widthPx: number }> = {
  "1:1": { className: "aspect-square", widthPx: TILE_HEIGHT_PX },
  "5:4": { className: "aspect-[5/4]", widthPx: TILE_HEIGHT_PX * 1.25 },
  "16:9": { className: "aspect-video", widthPx: (TILE_HEIGHT_PX * 16) / 9 },
};

/** How many columns a row this wide has: four for square tiles, else as many as fit, and at least one. */
export const columnsFor = (width: number, aspectRatio: AspectRatio) =>
  aspectRatio === "1:1"
    ? SQUARE_COLUMNS
    : Math.max(1, Math.floor((width + GAP_PX) / (TILE_SHAPES[aspectRatio].widthPx + GAP_PX)));

/** The row's column count, as the --columns variable its grid reads. */
export const columnsStyle = (columns: number) => ({ "--columns": columns }) as CSSProperties;

/** The row's width, measured and kept up to date as it resizes. Null until the row is mounted. */
export function useRowWidth(): [(node: HTMLDivElement | null) => void, number | null] {
  const [width, setWidth] = useState<number | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? null));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** The row's placeholder while its pictures load: as many tiles as the row will show. */
export const SkeletonRow: FC<{ count: number; aspectRatio: AspectRatio; label: string }> = ({ count, aspectRatio, label }) => {
  const [ref, width] = useRowWidth();
  const columns = width === null ? 0 : columnsFor(width, aspectRatio);
  return (
    <div
      ref={ref}
      className="my-3 grid w-full grid-cols-[repeat(var(--columns),minmax(0,1fr))] gap-2 first:mt-0"
      style={columnsStyle(columns)}
      aria-busy
      aria-label={label}
    >
      {Array.from({ length: Math.min(count, columns) }, (_, index) => (
        <Skeleton key={index} className={cn("rounded-xl", TILE_SHAPES[aspectRatio].className)} />
      ))}
      {/* Holds the row's height before it is measured, so nothing moves when the tiles appear. */}
      {columns === 0 && <div className="h-40" />}
    </div>
  );
};
