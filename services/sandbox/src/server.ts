import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_SERVED_FILE_BYTES,
  execRequestSchema,
  fsEditRequestSchema,
  fsReadRequestSchema,
  fsWriteRequestSchema,
  projectIdSchema,
  sessionIdSchema,
  skillFolderSchema,
  skillInstallRequestSchema,
  usernameSchema,
} from "@artemis/contracts";
import { SkillError, installSkill, listSkills, removeSkill } from "./skills.js";
import { SessionFileError, saveAttachment, saveGeneratedImage } from "./session-files.js";
import { runCommand } from "./exec.js";
import { FileError, editForAgent, readForAgent, serveFile, writeForAgent } from "./files.js";
import {
  ProjectError,
  ensureProject,
  readProjectIcon,
  removeProject,
  removeProjectIcon,
  saveProjectIcon,
} from "./projects.js";
import type { Roots } from "./paths.js";
import { removeSession, removeWorkspace, ensureWorkspace } from "./workspaces.js";

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

/**
 * Receives a raw file body for a session and stores it with `save`. The file name comes, percent-encoded, in the
 * x-file-name header.
 */
async function receiveFile(c: Context, maxBytes: number, save: typeof saveAttachment): Promise<Response> {
  const sessionId = sessionIdSchema.safeParse(c.req.param("sessionId"));
  if (!sessionId.success) return c.json({ error: "invalid session id" }, 400);

  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > maxBytes) return c.json({ error: "file is too large" }, 413);

  const encodedName = c.req.header("x-file-name") ?? "file";
  let name = encodedName;
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    // keep the raw header; sanitizeName cleans it up
  }
  const mediaType = c.req.header("content-type") ?? "application/octet-stream";
  const bytes = Buffer.from(await c.req.arrayBuffer());
  try {
    return c.json(await save(roots, sessionId.data, name, bytes, mediaType));
  } catch (error) {
    if (error instanceof SessionFileError) return c.json({ error: error.message }, 422);
    throw error;
  }
}

// Stores an uploaded file in the session's attachments folder. The body is the raw file.
app.post("/sessions/:sessionId/attachments", (c) => receiveFile(c, MAX_ATTACHMENT_BYTES, saveAttachment));

// Stores an image the agent generated in the session's images folder. The body is the raw image.
app.post("/sessions/:sessionId/images", (c) => receiveFile(c, MAX_SERVED_FILE_BYTES, saveGeneratedImage));

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
    if (error instanceof FileError) return c.json({ error: error.message }, 422);
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
    if (error instanceof FileError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

app.post("/fs/write", async (c) => {
  const parsed = fsWriteRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  try {
    return c.json(await writeForAgent(roots, parsed.data));
  } catch (error) {
    if (error instanceof FileError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

app.post("/fs/edit", async (c) => {
  const parsed = fsEditRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  try {
    return c.json(await editForAgent(roots, parsed.data));
  } catch (error) {
    if (error instanceof FileError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

// Per-user workspaces (/workspace/<username>) and per-conversation session folders. Created and removed by the web app,
// through the toolbox: create when a user is made, remove when an archived user is deleted.
app.put("/workspaces/:username", async (c) => {
  const username = usernameSchema.safeParse(c.req.param("username"));
  if (!username.success) return c.json({ error: username.error.issues[0]?.message ?? "invalid username" }, 400);
  await ensureWorkspace(roots, username.data);
  return c.json({ ok: true });
});

app.delete("/workspaces/:username", async (c) => {
  const username = usernameSchema.safeParse(c.req.param("username"));
  if (!username.success) return c.json({ error: username.error.issues[0]?.message ?? "invalid username" }, 400);
  await removeWorkspace(roots, username.data);
  return c.json({ ok: true });
});

// A user's skills (<workspace>/<username>/skills/<folder>/SKILL.md): listed for the agent's context and the settings
// page, installed from a marketplace and removed by the web app.
app.get("/workspaces/:username/skills", async (c) => {
  const username = usernameSchema.safeParse(c.req.param("username"));
  if (!username.success) return c.json({ error: username.error.issues[0]?.message ?? "invalid username" }, 400);
  return c.json({ skills: await listSkills(roots, username.data) });
});

app.put("/workspaces/:username/skills/:folder", async (c) => {
  const username = usernameSchema.safeParse(c.req.param("username"));
  if (!username.success) return c.json({ error: username.error.issues[0]?.message ?? "invalid username" }, 400);
  const folder = skillFolderSchema.safeParse(c.req.param("folder"));
  if (!folder.success) return c.json({ error: folder.error.issues[0]?.message ?? "invalid skill name" }, 400);
  const parsed = skillInstallRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  try {
    return c.json(await installSkill(roots, username.data, folder.data, parsed.data));
  } catch (error) {
    if (error instanceof SkillError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

app.delete("/workspaces/:username/skills/:folder", async (c) => {
  const username = usernameSchema.safeParse(c.req.param("username"));
  if (!username.success) return c.json({ error: username.error.issues[0]?.message ?? "invalid username" }, 400);
  const folder = skillFolderSchema.safeParse(c.req.param("folder"));
  if (!folder.success) return c.json({ error: folder.error.issues[0]?.message ?? "invalid skill name" }, 400);
  if (!(await removeSkill(roots, username.data, folder.data))) return c.json({ error: "no such skill" }, 404);
  return c.json({ ok: true });
});

// A project's folder in the user's workspace (<workspace>/<username>/projects/<id>) and its icon. The web app creates
// the folder when a project is made, uploads its icon, and removes the folder when the project is deleted.
app.put("/workspaces/:username/projects/:projectId", async (c) => {
  const ids = projectRouteIds(c.req.param("username"), c.req.param("projectId"));
  if (typeof ids === "string") return c.json({ error: ids }, 400);
  await ensureProject(roots, ids.username, ids.projectId);
  return c.json({ ok: true });
});

app.delete("/workspaces/:username/projects/:projectId", async (c) => {
  const ids = projectRouteIds(c.req.param("username"), c.req.param("projectId"));
  if (typeof ids === "string") return c.json({ error: ids }, 400);
  await removeProject(roots, ids.username, ids.projectId);
  return c.json({ ok: true });
});

// The body is the raw image; its content type decides the file's extension.
app.put("/workspaces/:username/projects/:projectId/icon", async (c) => {
  const ids = projectRouteIds(c.req.param("username"), c.req.param("projectId"));
  if (typeof ids === "string") return c.json({ error: ids }, 400);
  const bytes = Buffer.from(await c.req.arrayBuffer());
  try {
    const file = await saveProjectIcon(roots, ids.username, ids.projectId, bytes, c.req.header("content-type") ?? "");
    return c.json({ file });
  } catch (error) {
    if (error instanceof ProjectError) return c.json({ error: error.message }, 422);
    throw error;
  }
});

app.get("/workspaces/:username/projects/:projectId/icon", async (c) => {
  const ids = projectRouteIds(c.req.param("username"), c.req.param("projectId"));
  if (typeof ids === "string") return c.json({ error: ids }, 400);
  const icon = await readProjectIcon(roots, ids.username, ids.projectId);
  if (!icon) return c.json({ error: "no such icon" }, 404);
  return c.body(new Uint8Array(icon.bytes), 200, {
    "content-type": icon.mediaType,
    "content-length": String(icon.bytes.byteLength),
    "x-content-type-options": "nosniff",
    "cache-control": "private, no-cache",
  });
});

app.delete("/workspaces/:username/projects/:projectId/icon", async (c) => {
  const ids = projectRouteIds(c.req.param("username"), c.req.param("projectId"));
  if (typeof ids === "string") return c.json({ error: ids }, 400);
  await removeProjectIcon(roots, ids.username, ids.projectId);
  return c.json({ ok: true });
});

/** The validated username and project id of a project route, or the error message to answer with. */
function projectRouteIds(rawUsername: string, rawProjectId: string): { username: string; projectId: string } | string {
  const username = usernameSchema.safeParse(rawUsername);
  if (!username.success) return username.error.issues[0]?.message ?? "invalid username";
  const projectId = projectIdSchema.safeParse(rawProjectId);
  if (!projectId.success) return "invalid project id";
  return { username: username.data, projectId: projectId.data };
}

app.delete("/sessions/:sessionId", async (c) => {
  const sessionId = sessionIdSchema.safeParse(c.req.param("sessionId"));
  if (!sessionId.success) return c.json({ error: "invalid session id" }, 400);
  await removeSession(roots, sessionId.data);
  return c.json({ ok: true });
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`sandbox listening on :${info.port} (data ${roots.dataRoot}, workspace ${roots.workspaceRoot})`);
});

// Node runs as PID 1 in the container, which ignores SIGTERM unless a handler is set: without this, `docker stop`
// waits its whole timeout (30 s on each redeploy) before it kills the process. Finish the open requests, then exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 20_000).unref();
  });
}
