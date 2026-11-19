import { useQuery } from "@tanstack/react-query";
import { Linking } from "react-native";
import { absoluteUrl, apiFetch, authHeaders } from "@/lib/api";
import { HorizontalRow } from "./shared";
import { ImageTile, TILE_WIDTH } from "./image-tile";
import type { ProductGroupValue } from "./schemas";

type Product = ProductGroupValue["products"][number];

/** The product's picture, served by the server from the product's page (same URL as the web app's product-group.tsx). */
const productImageUrl = ({ name, link }: Product) =>
  `/api/product-image?${new URLSearchParams(link ? { url: link, name } : { name }).toString()}`;

/** A row of products, like a square image group: each picture with the product's name under it. A tap opens its page. */
export function ProductGroupVisual({ value }: { value: ProductGroupValue }) {
  return (
    <HorizontalRow gap={8}>
      {value.products.map((product) => (
        <ProductTile key={`${product.link ?? ""}-${product.name}`} product={product} />
      ))}
    </HorizontalRow>
  );
}

/**
 * One product. Its store page is the agent's link, or the one the server finds with a web search when there is none (as on
 * the web); a tap before it is known, or when none is found, does nothing.
 */
function ProductTile({ product }: { product: Product }) {
  const found = useQuery({
    queryKey: ["product-link", product.name],
    queryFn: async () =>
      (await apiFetch<{ link: string }>(`/api/product-link?${new URLSearchParams({ name: product.name }).toString()}`)).link,
    enabled: !product.link,
    staleTime: Infinity,
    retry: false,
  });
  const link = product.link ?? found.data;

  return (
    <ImageTile
      source={{ uri: absoluteUrl(productImageUrl(product)), headers: authHeaders() }}
      height={TILE_WIDTH}
      fit="contain"
      caption={product.name}
      label={`Open ${product.name}`}
      onPress={() => {
        if (link) void Linking.openURL(link);
      }}
    />
  );
}
