import { z } from "zod";
import type { SandboxClient } from "../sandbox-client.js";
import type { Tool } from "../registry.js";

const input = z.object({
  path: z
    .string()
    .min(1)
    .max(4096)
    .describe("File to read. A relative path starts in your default folder, /data/sessions/<id>. An absolute path is used as it is."),
  offset: z.number().int().min(1).optional().describe("First line to show, 1-based. Default 1."),
  limit: z.number().int().min(1).max(2000).optional().describe("How many lines to show. Default 2000."),
});

/**
 * Reads a text file with numbered lines, or an image so you can see it. Mirrors the Read tool
 * of Letta and Claude Code, adapted to an agent that works in its own sandbox.
 */
export function createReadTool(sandbox: SandboxClient): Tool<typeof input> {
  return {
    name: "read",
    description:
      "Read a file in your sandbox computer. Relative paths start in your default folder, /data/sessions/<id>. " +
      "Text comes back with line numbers; use offset and limit for long files. Images are returned so you can see them. " +
      "Read a file before you edit it.",
    input,
    async run({ path, offset, limit }, ctx) {
      return sandbox.fsRead({ sessionId: ctx.sessionId, path, offset, limit });
    },
  };
}
