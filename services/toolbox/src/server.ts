import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { sessionIdSchema, toolInvokeRequestSchema } from "@artemis/contracts";
import { ToolInputError, ToolNotFoundError, ToolRegistry } from "./registry.js";
import { SandboxClient } from "./sandbox-client.js";
import { createBashTool } from "./tools/bash.js";
import { createEditTool } from "./tools/edit.js";
import { createReadTool } from "./tools/read.js";
import { createWriteTool } from "./tools/write.js";

const port = Number(process.env.PORT ?? 8080);
const sandboxUrl = process.env.SANDBOX_URL ?? "http://sandbox:8080";

const sandbox = new SandboxClient(sandboxUrl);
const registry = new ToolRegistry([
  createBashTool(sandbox),
  createReadTool(sandbox),
  createWriteTool(sandbox),
  createEditTool(sandbox),
]);

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", tools: registry.list().map((t) => t.name) }));

app.get("/tools", (c) => c.json(registry.list()));

app.post("/tools/:name/invoke", async (c) => {
  const parsed = toolInvokeRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: "malformed request body" }, 400);
  }
  const sessionId = sessionIdSchema.safeParse(parsed.data.context.sessionId);
  if (!sessionId.success) {
    return c.json({ ok: false, error: sessionId.error.issues[0]?.message ?? "invalid sessionId" }, 400);
  }
  try {
    const output = await registry.invoke(c.req.param("name"), parsed.data.input, { sessionId: sessionId.data });
    return c.json({ ok: true, output });
  } catch (error) {
    if (error instanceof ToolNotFoundError) return c.json({ ok: false, error: error.message }, 404);
    if (error instanceof ToolInputError) return c.json({ ok: false, error: error.message }, 422);
    // Tool execution failures are returned to the model as tool errors, not HTTP errors.
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message });
  }
});

// Attachments: the web app uploads here, and the chat page downloads from here. Both are plain proxies to the sandbox.
app.post("/sessions/:sessionId/attachments", async (c) => {
  const sessionId = sessionIdSchema.safeParse(c.req.param("sessionId"));
  if (!sessionId.success) return c.json({ error: "invalid session id" }, 400);
  const body = await c.req.arrayBuffer();
  try {
    const saved = await sandbox.saveAttachment(
      sessionId.data,
      c.req.header("x-attachment-name") ?? "file",
      body,
      c.req.header("content-type") ?? "application/octet-stream",
    );
    return c.json(saved);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 422);
  }
});

app.get("/sessions/:sessionId/files", async (c) => {
  const sessionId = sessionIdSchema.safeParse(c.req.param("sessionId"));
  if (!sessionId.success) return c.json({ error: "invalid session id" }, 400);
  const filePath = c.req.query("path") ?? "";
  try {
    const file = await sandbox.serveFile(sessionId.data, filePath);
    if (!file) return c.json({ error: "no such file" }, 404);
    return c.body(new Uint8Array(file.bytes), 200, {
      "content-type": file.mediaType,
      "content-disposition": file.contentDisposition,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-cache",
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 422);
  }
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`toolbox listening on :${info.port}, sandbox at ${sandboxUrl}`);
});
