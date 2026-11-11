import { z } from "zod";
import type { SandboxClient } from "../sandbox-client.js";
import type { Tool } from "../registry.js";

const input = z.object({
  description: z
    .string()
    .min(3)
    .max(120)
    .describe("A few words saying what this command does, e.g. 'List project files'. Shown to the user."),
  command: z.string().min(1).max(20_000).describe("The bash command to run."),
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(300)
    .default(60)
    .describe("Kill the command after this many seconds (1-300)."),
});

/**
 * Runs a bash command on the sandbox. Output is returned as structured data so the model can read exit
 * codes and stderr separately. The description is static: the session folder is named as a placeholder.
 */
export function createBashTool(sandbox: SandboxClient): Tool<typeof input> {
  return {
    name: "bash",
    description:
      "Run a bash command in your sandbox computer and get stdout, stderr and the exit code. " +
      "Your default folder is /data/sessions/<id>, where bash, read, write and edit start. " +
      "Files there persist across calls within this conversation. " +
      "For projects that should persist across conversations, use your user workspace; its path is in the <user_metadata> block. " +
      "Commands time out after the given limit.",
    input,
    async run({ command, timeoutSeconds }, ctx) {
      // `description` is for the user's activity view only; it does not change execution.
      const result = await sandbox.exec(ctx.sessionId, command, timeoutSeconds * 1000);
      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        truncated: result.truncated,
        durationMs: result.durationMs,
      };
    },
  };
}
