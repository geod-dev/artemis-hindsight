import { z } from "zod";
import { usernameSchema } from "./users.js";

// The toolbox exposes a registry of tools over HTTP:
//   GET  /tools                 -> ToolDefinition[]
//   POST /tools/:name/invoke    -> ToolInvokeResponse

export const toolDefinitionSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  description: z.string(),
  // JSON Schema (draft 2020-12) generated from the tool's zod input schema.
  inputSchema: z.record(z.string(), z.unknown()),
});
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

export const toolInvokeRequestSchema = z.object({
  input: z.unknown(),
  context: z.object({
    sessionId: z.string().min(1).max(64),
    // The user the conversation belongs to. Their memory tools use it as their Hindsight bank.
    username: usernameSchema.optional(),
  }),
});
export type ToolInvokeRequest = z.infer<typeof toolInvokeRequestSchema>;

export const toolInvokeResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), output: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type ToolInvokeResponse = z.infer<typeof toolInvokeResponseSchema>;
