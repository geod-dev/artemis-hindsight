import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  MAX_ATTACHMENT_BYTES,
  execRequestSchema,
  fsEditRequestSchema,
  fsReadRequestSchema,
  fsWriteRequestSchema,
  sessionIdSchema,
} from "@artemis/contracts";
import { saveAttachment, AttachmentError } from "./attachments.js";
import { runCommand } from "./exec.js";
import { FileError, editForAgent, readForAgent, serveFile, writeForAgent } from "./files.js";
import { PathError, type Roots } from "./paths.js";

const port = Number(process.env.PORT ?? 8080);
const roots: Roots = {
  dataRoot: process.env.DATA_ROOT ?? "/data",
  workspaceRoot: process.env.WORKSPACE_ROOT ?? "/workspace",
};

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/exec", async (c) => {
  const parsed = execRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }
  const result = await runCommand({ dataRoot: roots.dataRoot, ...parsed.data });
  return c.json(result);
});

// Stores an uploaded file in the session's attachments folder. The body is the raw file.
app.post("/sessions/:sessionId/attachments", async (c) => {
  const sessionId = sessionIdSchema.safeParse(c.req.param("sessionId"));
  if (!sessionId.success) return c.json({ error: "invalid session id" }, 400);

  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_ATTACHMENT_BYTES) return c.json({ error: "file is too large" }, 413);

  const encodedName = c.req.header("x-attachment-name") ?? "file";
  let name = encodedName;
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    // keep the raw header; sanitizeName cleans it up
  }
  const mediaType = c.req.header("content-type") ?? "application/octet-stream";
  const bytes = Buffer.from(await c.req.arrayBuffer());
  try {
    return c.json(await saveAttachment(roots, sessionId.data, name, bytes, mediaType));
  } catch (error) {
    if (error instanceof AttachmentError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

// Serves a file from the session (or /workspace) for previews and downloads.
app.get("/sessions/:sessionId/files", async (c) => {
  const sessionId = sessionIdSchema.safeParse(c.req.param("sessionId"));
  if (!sessionId.success) return c.json({ error: "invalid session id" }, 400);
  const filePath = c.req.query("path");
  if (!filePath) return c.json({ error: "path is required" }, 400);
  try {
    const { bytes, mediaType, name } = await serveFile(roots, sessionId.data, filePath);
    const inline = mediaType.startsWith("image/") || mediaType === "application/pdf";
    return c.body(new Uint8Array(bytes), 200, {
      "content-type": mediaType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-cache",
    });
  } catch (error) {
    if (error instanceof FileError || error instanceof PathError) return c.json({ error: error.message }, 422);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return c.json({ error: "no such file" }, 404);
    throw error;
  }
});

// The agent's file tools. Errors are returned as 422 so the toolbox can hand them to the model.
app.post("/fs/read", async (c) => {
  const parsed = fsReadRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  try {
    return c.json(await readForAgent(roots, parsed.data));
  } catch (error) {
    if (error instanceof FileError || error instanceof PathError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

app.post("/fs/write", async (c) => {
  const parsed = fsWriteRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  try {
    return c.json(await writeForAgent(roots, parsed.data));
  } catch (error) {
    if (error instanceof FileError || error instanceof PathError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

app.post("/fs/edit", async (c) => {
  const parsed = fsEditRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  try {
    return c.json(await editForAgent(roots, parsed.data));
  } catch (error) {
    if (error instanceof FileError || error instanceof PathError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`sandbox listening on :${info.port} (data ${roots.dataRoot}, workspace ${roots.workspaceRoot})`);
});
