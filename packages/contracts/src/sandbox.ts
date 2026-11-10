import { z } from "zod";

// The sandbox is the agent's computer. It runs shell commands inside a
// per-conversation workspace directory. It is only reachable from the toolbox.

export const sessionIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "sessionId must be 1-64 chars of [A-Za-z0-9_-]");

export const execRequestSchema = z.object({
  sessionId: sessionIdSchema,
  command: z.string().min(1).max(20_000),
  timeoutMs: z.number().int().min(1_000).max(300_000).default(60_000),
});
export type ExecRequest = z.input<typeof execRequestSchema>;

export const execResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int().nullable(),
  timedOut: z.boolean(),
  truncated: z.boolean(),
  durationMs: z.number().nonnegative(),
});
export type ExecResult = z.infer<typeof execResultSchema>;

// Limits shared by the web app, the toolbox and the sandbox.
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_CHARS = 5_000_000;

// Attachments are stored in <session>/attachments/ by the sandbox. Their paths are relative to the session folder.
export const attachmentSavedSchema = z.object({
  name: z.string(),
  path: z.string(), // e.g. "attachments/report.pdf"
  absolutePath: z.string(),
  mediaType: z.string(),
  size: z.number().int().nonnegative(),
});
export type AttachmentSaved = z.infer<typeof attachmentSavedSchema>;

export const fsReadRequestSchema = z.object({
  sessionId: sessionIdSchema,
  path: z.string().min(1).max(4096),
  offset: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(2000).optional(),
});
export type FsReadRequest = z.input<typeof fsReadRequestSchema>;

export const fsReadResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    path: z.string(),
    content: z.string(), // numbered lines, "     12\tline"
    totalLines: z.number().int().nonnegative(),
    fromLine: z.number().int().nonnegative(),
    toLine: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  z.object({
    kind: z.literal("image"),
    path: z.string(),
    mediaType: z.string(),
    base64: z.string(),
    size: z.number().int().nonnegative(),
  }),
]);
export type FsReadResult = z.infer<typeof fsReadResultSchema>;

export const fsWriteRequestSchema = z.object({
  sessionId: sessionIdSchema,
  path: z.string().min(1).max(4096),
  content: z.string().max(MAX_FILE_CHARS),
});
export type FsWriteRequest = z.input<typeof fsWriteRequestSchema>;

export const fsWriteResultSchema = z.object({
  path: z.string(),
  created: z.boolean(),
  bytes: z.number().int().nonnegative(),
});
export type FsWriteResult = z.infer<typeof fsWriteResultSchema>;

export const fsEditRequestSchema = z.object({
  sessionId: sessionIdSchema,
  path: z.string().min(1).max(4096),
  oldString: z.string().min(1).max(MAX_FILE_CHARS),
  newString: z.string().max(MAX_FILE_CHARS),
  replaceAll: z.boolean().default(false),
});
export type FsEditRequest = z.input<typeof fsEditRequestSchema>;

export const fsEditResultSchema = z.object({
  path: z.string(),
  replacements: z.number().int().nonnegative(),
});
export type FsEditResult = z.infer<typeof fsEditResultSchema>;
