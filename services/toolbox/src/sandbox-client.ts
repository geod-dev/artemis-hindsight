import {
  attachmentSavedSchema,
  execResultSchema,
  fsEditResultSchema,
  fsReadResultSchema,
  fsWriteResultSchema,
  type AttachmentSaved,
  type ExecResult,
  type FsEditRequest,
  type FsEditResult,
  type FsReadRequest,
  type FsReadResult,
  type FsWriteRequest,
  type FsWriteResult,
} from "@artemis/contracts";

/** Thin HTTP client for the sandbox service. The toolbox is its only caller. */
export class SandboxClient {
  constructor(private readonly baseUrl: string) {}

  async exec(sessionId: string, command: string, timeoutMs: number): Promise<ExecResult> {
    const res = await this.post("/exec", { sessionId, command, timeoutMs }, timeoutMs + 15_000);
    return execResultSchema.parse(await res.json());
  }

  async fsRead(input: FsReadRequest): Promise<FsReadResult> {
    return fsReadResultSchema.parse(await (await this.post("/fs/read", input)).json());
  }

  async fsWrite(input: FsWriteRequest): Promise<FsWriteResult> {
    return fsWriteResultSchema.parse(await (await this.post("/fs/write", input)).json());
  }

  async fsEdit(input: FsEditRequest): Promise<FsEditResult> {
    return fsEditResultSchema.parse(await (await this.post("/fs/edit", input)).json());
  }

  /** Stores an uploaded file. The body is the raw file bytes. */
  async saveAttachment(sessionId: string, name: string, bytes: ArrayBuffer, mediaType: string): Promise<AttachmentSaved> {
    const res = await fetch(new URL(`/sessions/${encodeURIComponent(sessionId)}/attachments`, this.baseUrl), {
      method: "POST",
      headers: { "content-type": mediaType, "x-attachment-name": encodeURIComponent(name) },
      body: bytes,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res));
    return attachmentSavedSchema.parse(await res.json());
  }

  /** Fetches a session file for a preview or download. Returns null when it does not exist. */
  async serveFile(sessionId: string, filePath: string): Promise<{ bytes: ArrayBuffer; mediaType: string; contentDisposition: string } | null> {
    const url = new URL(`/sessions/${encodeURIComponent(sessionId)}/files`, this.baseUrl);
    url.searchParams.set("path", filePath);
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await this.errorMessage(res));
    return {
      bytes: await res.arrayBuffer(),
      mediaType: res.headers.get("content-type") ?? "application/octet-stream",
      contentDisposition: res.headers.get("content-disposition") ?? "attachment",
    };
  }

  /** Creates a user's workspace folder (/workspace/<username>). Idempotent. */
  async ensureWorkspace(username: string): Promise<void> {
    await this.send("PUT", `/workspaces/${encodeURIComponent(username)}`);
  }

  /** Removes a user's workspace folder with everything in it. */
  async removeWorkspace(username: string): Promise<void> {
    await this.send("DELETE", `/workspaces/${encodeURIComponent(username)}`);
  }

  /** Removes a conversation's session folder (its files and attachments). */
  async removeSession(sessionId: string): Promise<void> {
    await this.send("DELETE", `/sessions/${encodeURIComponent(sessionId)}`);
  }

  private async send(method: "PUT" | "DELETE", path: string): Promise<void> {
    const res = await fetch(new URL(path, this.baseUrl), { method, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(await this.errorMessage(res));
  }

  private async post(path: string, body: unknown, timeoutMs = 30_000): Promise<Response> {
    const res = await fetch(new URL(path, this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(await this.errorMessage(res));
    return res;
  }

  private async errorMessage(res: Response): Promise<string> {
    const body: unknown = await res.json().catch(() => null);
    return typeof body === "object" && body !== null && "error" in body
      ? String(body.error)
      : `sandbox returned ${res.status}`;
  }
}
