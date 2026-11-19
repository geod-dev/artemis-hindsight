import { z } from "zod";
import { getConfig } from "../config";
import type { StoredImageResult } from "../db/schema";
import { findImageSearch, saveImageSearch } from "../repositories/image-search-repository";

// The Brave Search API: image search for the image groups the agent puts in its replies, and web search for the store
// page of a product group's product when the agent gives none.

const imageSearchSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().nullish(),
      url: z.string().nullish(),
      source: z.string().nullish(),
      thumbnail: z.object({ src: z.string() }).nullish(),
      properties: z.object({ url: z.string().nullish() }).nullish(),
    }),
  ),
});

const webSearchSchema = z.object({
  web: z.object({ results: z.array(z.object({ url: z.string() })) }).nullish(),
});

export type ImageResult = StoredImageResult;

export class ImageSearchUnavailableError extends Error {}

/** How many results each query asks Brave for, and the most an image group takes per query. Stored results are for this count. */
export const IMAGE_RESULT_COUNT = 8;

// A reply is shown again on every reload and every remount, so the same query comes back often. Each query is
// searched once and stored in the database; a reload reads it from there. Searches of the same query that arrive
// while Brave is still answering share that one call.
const inFlight = new Map<string, Promise<ImageResult[]>>();

const storageKey = (query: string) => query.replace(/\s+/g, " ").trim().toLowerCase();

export async function searchImages(query: string): Promise<ImageResult[]> {
  const key = storageKey(query);
  const stored = await findImageSearch(key);
  if (stored) return stored;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const search = (async () => {
    const results = await fetchBraveImages(query);
    await saveImageSearch(key, results);
    return results;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, search);
  return search;
}

/**
 * The images of an image group: `perQuery` results of each query, alternating between the queries (the first image
 * of each query in order, then the second of each, and so on), so the visible tiles show every query before the "+N".
 * An image already taken by another query is skipped for that query's next result. A query that fails, or has fewer
 * results, shows fewer images; the group fails only when every query fails.
 */
export async function searchImageGroup(queries: string[], perQuery: number): Promise<ImageResult[]> {
  const settled = await Promise.allSettled(queries.map((query) => searchImages(query)));
  if (settled.every((outcome) => outcome.status === "rejected")) throw settled[0]!.reason;

  // Copies, so the stored results are not consumed.
  const candidates = settled.map((outcome, index) => {
    if (outcome.status === "fulfilled") return [...outcome.value];
    const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
    console.warn("image search failed for one image group query", { query: queries[index], reason });
    return [];
  });

  const seen = new Set<string>();
  const picked: ImageResult[] = [];
  for (let round = 0; round < perQuery; round++) {
    for (const list of candidates) {
      let next = list.shift();
      while (next && seen.has(next.imageUrl)) next = list.shift();
      if (!next) continue;
      seen.add(next.imageUrl);
      picked.push(next);
    }
  }
  return picked;
}

// Brave limits requests per second (1 on the free plan) and answers 429 above. A group searches up to 8 queries at
// once, so each call waits for its own slot. The slots are a little more than 1 / BRAVE_REQUESTS_PER_SECOND seconds
// apart: exactly 1 s apart, network jitter can still put two requests in the same second at Brave.
let nextSlotAt = 0;

async function waitForBraveSlot(): Promise<void> {
  const interval = 1100 / getConfig().BRAVE_REQUESTS_PER_SECOND;
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + interval;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

async function fetchBraveImages(query: string): Promise<ImageResult[]> {
  const apiKey = getConfig().BRAVE_API_KEY;
  if (!apiKey) throw new ImageSearchUnavailableError("BRAVE_API_KEY is not set");

  // A 429 (rate limited, by another client of the same key for instance) is retried once, in a later slot.
  let res = await braveImageRequest(query, apiKey);
  if (res.status === 429) res = await braveImageRequest(query, apiKey);
  if (!res.ok) throw new Error(`brave image search failed with HTTP ${res.status}`);

  const body = imageSearchSchema.parse(await res.json());

  return body.results.flatMap((item): ImageResult[] => {
    const thumbnailUrl = item.thumbnail?.src;
    if (!thumbnailUrl) return [];
    return [
      {
        thumbnailUrl,
        imageUrl: item.properties?.url ?? thumbnailUrl,
        pageUrl: item.url ?? null,
        title: item.title ?? "",
        source: item.source ?? "",
      },
    ];
  });
}

async function braveImageRequest(query: string, apiKey: string): Promise<Response> {
  return braveRequest("images/search", query, IMAGE_RESULT_COUNT, apiKey);
}

/** The URLs of a web search's results, best first. Not stored: callers keep what they need. */
export async function searchWeb(query: string, count = 10): Promise<string[]> {
  const apiKey = getConfig().BRAVE_API_KEY;
  if (!apiKey) throw new ImageSearchUnavailableError("BRAVE_API_KEY is not set");

  // A 429 is retried once, in a later slot, as for images.
  let res = await braveRequest("web/search", query, count, apiKey);
  if (res.status === 429) res = await braveRequest("web/search", query, count, apiKey);
  if (!res.ok) throw new Error(`brave web search failed with HTTP ${res.status}`);
  return (webSearchSchema.parse(await res.json()).web?.results ?? []).map((result) => result.url);
}

/** One call to the Brave Search API, in its own rate-limit slot. */
async function braveRequest(endpoint: "images/search" | "web/search", query: string, count: number, apiKey: string) {
  await waitForBraveSlot();
  const url = new URL(`https://api.search.brave.com/res/v1/${endpoint}`);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  return fetch(url, {
    headers: { accept: "application/json", "x-subscription-token": apiKey },
    signal: AbortSignal.timeout(8_000),
  });
}
