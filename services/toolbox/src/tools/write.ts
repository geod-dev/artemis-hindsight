import { z } from "zod";
import type { SandboxClient } from "../sandbox-client.js";
import type { Tool } from "../registry.js";

const input = z.object({
  path: z
    .string()
    .min(1)
    .max(4096)
    .describe("File to write. A relative path starts in your default folder, /data/sessions/<id>. An absolute path is used as it is."),
  content: z.string().max(5_000_000).describe("The full content of the file."),
});

/** Creates or overwrites a file. Mirrors the Write tool of Letta, adapted to an agent in its own sandbox. */
export function createWriteTool(sandbox: SandboxClient): Tool<typeof input> {
  return {
    name: "write",
    description:
      "Create a file or overwrite it in your sandbox computer. Relative paths start in your default folder, /data/sessions/<id>. " +
      "Missing folders are created. For a small change to an existing file, use edit instead.",
    input,
    async run({ path, content }, ctx) {
      return sandbox.fsWrite({ sessionId: ctx.sessionId, path, content });
    },
  };
}
