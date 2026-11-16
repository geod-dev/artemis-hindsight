import { fetch as expoFetch } from "expo/fetch";

/**
 * The HTTP client for the Artemis server. The server address and the session token are set by the auth
 * provider; every request goes through here so they are attached the same way everywhere.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ClientSession {
  serverUrl: string;
  token: string | null;
  onUnauthorized?: () => void;
}

const session: ClientSession = { serverUrl: "", token: null };

export function setClientSession(next: { serverUrl: string; token: string | null }): void {
  session.serverUrl = next.serverUrl;
  session.token = next.token;
}

/** Called when the server rejects the token: the auth provider signs the user out. */
export function onUnauthorized(handler: () => void): void {
  session.onUnauthorized = handler;
}

export function serverUrl(): string {
  return session.serverUrl;
}

/** The headers a native image or download needs to reach a protected server file. */
export function authHeaders(): Record<string, string> {
  return session.token ? { authorization: `Bearer ${session.token}` } : {};
}

/** Turns a server path such as "/api/conversations/..." into the absolute url the device needs. */
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${session.serverUrl}${path}`;
}

function requestHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (session.token) headers.set("authorization", `Bearer ${session.token}`);
  return headers;
}

/** A fetch for the AI SDK transport: streams responses (expo/fetch) and carries the bearer token. */
export const authorizedStreamFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  return expoFetch(url, { ...init, headers: requestHeaders(init?.headers) } as Parameters<typeof expoFetch>[1]) as unknown as Promise<Response>;
};

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers: extra, ...rest } = init;
  const headers = requestHeaders(extra);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  }
  const res = await fetch(absoluteUrl(path), { ...rest, body, headers });
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    if (res.status === 401) session.onUnauthorized?.();
    throw new ApiError(payload?.error ?? `HTTP ${res.status}`, res.status);
  }
  return payload as T;
}

/** A multipart upload (attachments, dictation). The field name and file come from the caller. */
export async function apiUpload<T>(path: string, field: string, file: { uri: string; name: string; type: string }): Promise<T> {
  const form = new FormData();
  // React Native's FormData takes a file descriptor in place of a Blob.
  form.append(field, file as unknown as Blob);
  const res = await fetch(absoluteUrl(path), { method: "POST", body: form, headers: requestHeaders() });
  const payload = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok) {
    if (res.status === 401) session.onUnauthorized?.();
    throw new ApiError(payload?.error ?? `HTTP ${res.status}`, res.status);
  }
  return payload as T;
}
