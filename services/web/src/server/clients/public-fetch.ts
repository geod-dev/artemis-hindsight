import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

// Fetching URLs that come from outside the server (a link the agent wrote). Such a URL could point at the server's own
// network: Postgres, the toolbox, Hindsight, the router. Every hop is checked: only http and https, and only hosts whose
// addresses are all public. Redirects are followed by hand, so each new location is checked before it is fetched.

const MAX_REDIRECTS = 5;

/** A URL the server refuses to fetch: not http(s), private, or redirecting too often. */
export class UnsafeUrlError extends Error {}

/** Throws UnsafeUrlError unless the URL is http(s) and every address of its host is a public one. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("only http and https links");
  if (url.username || url.password) throw new UnsafeUrlError("links with credentials are refused");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address);
  for (const address of addresses) {
    let parsed = ipaddr.parse(address);
    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) parsed = parsed.toIPv4Address();
    if (parsed.range() !== "unicast") throw new UnsafeUrlError("the link points to a private address");
  }
}

/** Fetches a URL from outside, checking it and every redirect. Returns the response and the URL it came from. */
export async function fetchPublicUrl(input: string, init: RequestInit = {}): Promise<{ response: Response; url: URL }> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    return { response, url };
  }
  throw new UnsafeUrlError("too many redirects");
}

/** Reads a response body, up to `maxBytes`. Returns null when the body is larger. */
export async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
