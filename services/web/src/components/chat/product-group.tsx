"use client";

import { useEffect, useState, type FC } from "react";
import { ImageOffIcon } from "lucide-react";
import { z } from "zod";
import { field } from "@/components/assistant-ui/elements/surfaces";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { columnsStyle, SkeletonRow, useRowWidth } from "./image-row";
import { jsonVisual } from "./visual-block";

// A product group is a row of products the agent puts in its reply: the picture of each, its name under it, and a click
// that opens its page on the store. Written as a code block:
//
//   ```visual__product_group
//   { "products": [{ "name": "Google Pixel 10", "link": "https://store.google.com/product/pixel_10" }] }
//   ```
//
// It lays out in equal columns that fill the row (see ProductGroup), with one height for all tiles. The link is optional: without it, the server finds the store
// page with a web search. The server reads each picture from the product's page.

/** The code block language of a product group. Same in apps/mobile/src/chat/visuals. */
export const PRODUCT_GROUP_LANGUAGE = "visual__product_group";

const MAX_PRODUCTS = 4;

const productGroupSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        link: z.url({ protocol: /^https?$/ }).max(2048).optional(),
      }),
    )
    .min(1)
    .max(MAX_PRODUCTS),
});

type Product = z.output<typeof productGroupSchema>["products"][number];

/** The product's picture, served by the server from the product's page (see /api/product-image). */
const productImageUrl = ({ name, link }: Product) =>
  `/api/product-image?${new URLSearchParams(link ? { url: link, name } : { name }).toString()}`;

/** The product's store page: the agent's link, else the one the server finds (undefined until then, or if none). */
function useStoreLink({ name, link }: Product): string | undefined {
  const [found, setFound] = useState<string>();
  useEffect(() => {
    if (link) return;
    const controller = new AbortController();
    fetch(`/api/product-link?${new URLSearchParams({ name }).toString()}`, { signal: controller.signal })
      .then(async (res) => (res.ok ? ((await res.json()) as { link: string }).link : undefined))
      .then(setFound)
      .catch(() => undefined);
    return () => controller.abort();
  }, [name, link]);
  return link ?? found;
}

// The tiles' shared ratio (width / height) stays between portrait 3:4 and landscape 16:9, so one odd picture cannot
// make the whole row very tall or very flat.
const MIN_RATIO = 3 / 4;
const MAX_RATIO = 16 / 9;

/**
 * The ratio every tile of the group takes: the widest of the pictures loaded so far. Width comes first: every picture
 * fills its tile's width, and only the taller ones lose some top and bottom. Square until a picture has loaded.
 */
function sharedRatio(ratios: number[]): number {
  if (ratios.length === 0) return 1;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ...ratios));
}

/**
 * One product: its picture (a skeleton until it loads, an icon if it cannot), and its name under it. Without a store page
 * (still searching, or none found), the tile is not a link. `onRatio` reports the picture's own ratio once it loads.
 */
const ProductTile: FC<{ product: Product; ratio: number; onRatio: (ratio: number) => void }> = ({ product, ratio, onRatio }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const href = useStoreLink(product);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${product.name}`}
      className="group/product flex min-w-0 flex-col gap-1.5 no-underline outline-none"
    >
      <span
        style={{ aspectRatio: ratio }}
        className={cn(
          field,
          "group-focus-visible/product:ring-foreground/30 relative block overflow-hidden rounded-xl transition-[transform,background-color] duration-150 group-hover/product:scale-[1.01] group-focus-visible/product:ring-1 group-active/product:scale-[0.98] motion-reduce:transition-none",
        )}
      >
        {status === "failed" ? (
          <span className="text-muted-foreground flex size-full items-center justify-center">
            <ImageOffIcon aria-hidden className="size-6" />
          </span>
        ) : (
          <img
            src={productImageUrl(product)}
            alt=""
            loading="lazy"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) onRatio(naturalWidth / naturalHeight);
              setStatus("loaded");
            }}
            onError={() => setStatus("failed")}
            className={cn("size-full object-cover", status === "loading" && "opacity-0")}
          />
        )}
        {status === "loading" && <Skeleton className="absolute inset-0 rounded-none" />}
      </span>
      <span className="text-foreground line-clamp-2 text-xs font-medium">{product.name}</span>
    </a>
  );
};

const productKey = (product: Product) => `${product.link ?? ""}-${product.name}`;

/** Narrowest a product tile gets before the row wraps. */
const MIN_TILE_PX = 160;
const GAP_PX = 8; // gap-2

/**
 * Equal columns that fill the row: as many as fit at MIN_TILE_PX, never more than there are products, so the row is
 * always full and wraps on a narrow screen. Every tile has the same height (see sharedRatio).
 */
const ProductGroup: FC<{ products: Product[] }> = ({ products }) => {
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const ratio = sharedRatio(Object.values(ratios));
  const [ref, width] = useRowWidth();
  const fit = width === null ? products.length : Math.max(1, Math.floor((width + GAP_PX) / (MIN_TILE_PX + GAP_PX)));
  return (
    <div
      ref={ref}
      className="not-prose my-3 grid w-full grid-cols-[repeat(var(--columns),minmax(0,1fr))] gap-2 first:mt-0"
      style={columnsStyle(Math.min(products.length, fit))}
      aria-label="Products"
    >
      {products.map((product) => {
        const key = productKey(product);
        return (
          <ProductTile
            key={key}
            product={product}
            ratio={ratio}
            onRatio={(own) => setRatios((current) => (current[key] === own ? current : { ...current, [key]: own }))}
          />
        );
      })}
    </div>
  );
};

/** Renders a ```visual__product_group code block as a row of products. */
export const productGroupBlock = jsonVisual({
  language: PRODUCT_GROUP_LANGUAGE,
  name: "Products",
  schema: productGroupSchema,
  skeleton: <SkeletonRow count={MAX_PRODUCTS} aspectRatio="1:1" label="Loading products" />,
  render: ({ products }) => <ProductGroup products={products} />,
});
