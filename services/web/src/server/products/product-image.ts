import ogs from "open-graph-scraper";
import { searchImages } from "../clients/brave-client";
import { fetchPublicUrl, readLimited } from "../clients/public-fetch";

// The picture of a product in a reply's product group. Shops put their product photo in the page's meta tags for link
// previews, so the picture comes from the product's page: og:image, then twitter:image, then the image of a schema.org
// Product. A shop that blocks the request, or a page without one, falls back to an image search on the product's name.
// The picture is always served by this server, so the browser and the phone never call another site with the session.

const TIMEOUT_MS = 8_000;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** How many pages' picture URLs are kept in memory, so a reload does not read the shop's page again. */
const MAX_CACHED_PAGES = 500;

// Link preview fetchers announce themselves: shops serve their meta tags to them.
const HEADERS = { "user-agent": "Mozilla/5.0 (compatible; ArtemisLinkPreview/1.0)", "accept-language": "en,fr;q=0.8" };

export interface ProductImage {
  bytes: Uint8Array<ArrayBuffer>;
  mediaType: string;
}

/** Each page's picture URL (null: the page has none, or could not be read). Oldest entries leave first. */
const pictureUrls = new Map<string, string | null>();

/**
 * The product's picture: from its page (when it has one), else from an image search on its name. Null when neither
 * finds one.
 */
export async function findProductImage(pageUrl: string | null, name: string): Promise<ProductImage | null> {
  const fromPage = pageUrl ? await pictureUrlOf(pageUrl) : null;
  const image = fromPage ? await downloadImage(fromPage) : null;
  if (image) return image;
  const fromSearch = await searchedPictureUrl(name);
  return fromSearch ? downloadImage(fromSearch) : null;
}

async function pictureUrlOf(pageUrl: string): Promise<string | null> {
  if (pictureUrls.has(pageUrl)) return pictureUrls.get(pageUrl) ?? null;
  const found = await readPictureUrl(pageUrl);
  pictureUrls.set(pageUrl, found);
  if (pictureUrls.size > MAX_CACHED_PAGES) pictureUrls.delete(pictureUrls.keys().next().value!);
  return found;
}

/** Reads the page and returns the absolute URL of its product picture, or null. Never throws. */
async function readPictureUrl(pageUrl: string): Promise<string | null> {
  try {
    const { response, url } = await fetchPublicUrl(pageUrl, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("html")) {
      await response.body?.cancel();
      return null;
    }
    const bytes = await readLimited(response, MAX_PAGE_BYTES);
    if (!bytes) return null;
    const { result } = await ogs({ html: new TextDecoder().decode(bytes), onlyGetOpenGraphInfo: ["image"] });
    const picture = result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url ?? jsonLdProductImage(result.jsonLD);
    return picture ? new URL(picture, url).toString() : null;
  } catch (error) {
    console.warn("product page unreadable", { pageUrl, reason: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** The image of the first schema.org Product in the page's JSON-LD: a URL, a list of them, or an ImageObject. */
function jsonLdProductImage(items: object[] | undefined): string | undefined {
  for (const item of items ?? []) {
    const graph = (item as { "@graph"?: unknown })["@graph"];
    const nodes: unknown[] = Array.isArray(graph) ? graph : [item];
    for (const node of nodes) {
      const { "@type": type, image } = (node ?? {}) as { "@type"?: unknown; image?: unknown };
      if (type !== "Product" && !(Array.isArray(type) && type.includes("Product"))) continue;
      const first: unknown = Array.isArray(image) ? image[0] : image;
      if (typeof first === "string") return first;
      if (first && typeof (first as { url?: unknown }).url === "string") return (first as { url: string }).url;
    }
  }
  return undefined;
}

/** The first image search result for the product's name: Brave's thumbnail, which always loads. Never throws. */
async function searchedPictureUrl(name: string): Promise<string | null> {
  try {
    return (await searchImages(name))[0]?.thumbnailUrl ?? null;
  } catch (error) {
    console.warn("product image search failed", { name, reason: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Downloads a picture, when it is an image and not too large. Never throws. SVG is refused: served from this origin, an
 * SVG could run script with the user's session.
 */
async function downloadImage(imageUrl: string): Promise<ProductImage | null> {
  try {
    const { response } = await fetchPublicUrl(imageUrl, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!response.ok || !mediaType.startsWith("image/") || mediaType === "image/svg+xml") {
      await response.body?.cancel();
      return null;
    }
    const bytes = await readLimited(response, MAX_IMAGE_BYTES);
    return bytes ? { bytes, mediaType } : null;
  } catch (error) {
    console.warn("product image unavailable", { imageUrl, reason: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
