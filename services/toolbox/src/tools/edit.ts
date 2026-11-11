import { z } from "zod";
import type { SandboxClient } from "../sandbox-client.js";
import type { Tool } from "../registry.js";

const input = z.object({
  path: z
    .string()
    .min(1)
    .max(4096)
    .describe("File to edit. A relative path starts in your default folder, /data/sessions/<id>. An absolute path is used as it is."),
  oldString: z.string().min(1).max(5_000_000).describe("The exact text to replace, including whitespace and line breaks."),
  newString: z.string().max(5_000_000).describe("What to replace it with."),
  replaceAll: z.boolean().optional().describe("Replace every match instead of requiring exactly one. Default false."),
});

/** Replaces an exact piece of text. Mirrors the Edit tool of Letta, adapted to an agent in its own sandbox. */
export function createEditTool(sandbox: SandboxClient): Tool<typeof input> {
  return {
    name: "edit",
    description:
      "Replace an exact piece of text in a file in your sandbox computer. oldString must match exactly once unless replaceAll is true. " +
      "Read the file first so you copy the text exactly.",
    input,
    async run({ path, oldString, newString, replaceAll }, ctx) {
      return sandbox.fsEdit({ sessionId: ctx.sessionId, path, oldString, newString, replaceAll: replaceAll ?? false });
    },
  };
}
