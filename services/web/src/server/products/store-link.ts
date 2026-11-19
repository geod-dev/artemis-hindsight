import { searchWeb } from "../clients/brave-client";

// The store page of a product the agent named without a link: the first result of a web search for its name that is
// not an obvious non-store site. Found once per product name and kept in memory; searches of the same name that
// arrive together share one call.

/** Sites that rank for a product name without selling anything. */
const NOT_STORES = ["youtube.com", "wikipedia.org", "reddit.com", "quora.com", "facebook.com", "instagram.com", "tiktok.com"];
const MAX_CACHED = 500;

const links = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

const keyOf = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

const isStore = (link: string) => {
  try {
    const { protocol, hostname } = new URL(link);
    return (protocol === "https:" || protocol === "http:") && !NOT_STORES.some((site) => hostname === site || hostname.endsWith(`.${site}`));
  } catch {
    return false;
  }
};

/** The product's store page, or null when the search finds none or fails. Never throws. */
export async function findStoreLink(name: string): Promise<string | null> {
  const key = keyOf(name);
  if (links.has(key)) return links.get(key) ?? null;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const search = (async () => {
    try {
      const link = (await searchWeb(name)).find(isStore) ?? null;
      links.set(key, link);
      if (links.size > MAX_CACHED) links.delete(links.keys().next().value!);
      return link;
    } catch (error) {
      // Not cached: a later try may succeed.
      console.warn("store link search failed", { name, reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, search);
  return search;
}
