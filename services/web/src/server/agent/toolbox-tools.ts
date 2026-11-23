import { jsonSchema, tool, type JSONValue, type ToolSet } from "ai";
import { invokeToolboxTool, listToolboxTools } from "../clients/toolbox-client";
import { recordModelUsage } from "../usage/usage-service";

/** The toolbox's memory tools (services/toolbox/src/tools/memory.ts). They read the user's Hindsight bank. */
const MEMORY_TOOLS = new Set(["recall", "reflect"]);

/**
 * Turns the toolbox registry into AI SDK tools for one conversation.
 * Every tool call is forwarded to the toolbox with the conversation id as the sandbox session and the user's
 * username, which the memory tools use as their Hindsight bank. Without a username (an unpersonalized temporary chat),
 * the memory tools are left out and the toolbox is never told who the user is.
 *
 * A tool whose model spent tokens (generate_image) puts them under `usage` in its output: they are recorded in
 * the user's usage and taken out of the output before the model reads it.
 */
export async function buildToolboxTools(sessionId: string, username: string | null, userId: string): Promise<ToolSet> {
  const definitions = (await listToolboxTools()).filter((definition) => username || !MEMORY_TOOLS.has(definition.name));

  const entries = definitions.map((definition) => [
    definition.name,
    tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (input: unknown) => {
        const result = await invokeToolboxTool(definition.name, input, { sessionId, ...(username ? { username } : {}) });
        if (!result.ok) throw new Error(result.error);
        return takeUsage(result.output, userId, sessionId);
      },
      toModelOutput: ({ output }) => toModelOutput(output),
    }),
  ]);

  return Object.fromEntries(entries);
}

/**
 * The `usage` a tool's output may carry (services/toolbox/src/tools/generate-image.ts). Memory is not here: its usage
 * is read from Hindsight's own traces (server/usage/usage-service.ts).
 */
interface OutputUsage {
  part: "image";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  imageInputTokens?: number;
}

function isOutputUsage(value: unknown): value is OutputUsage {
  const usage = value as Partial<OutputUsage> | null;
  return (
    typeof usage === "object" &&
    usage !== null &&
    usage.part === "image" &&
    typeof usage.model === "string" &&
    typeof usage.inputTokens === "number" &&
    typeof usage.outputTokens === "number"
  );
}

/** Records the `usage` of a tool's output, and returns the output without it: the model never reads token counts. */
async function takeUsage(output: unknown, userId: string, conversationId: string): Promise<unknown> {
  if (typeof output !== "object" || output === null || !("usage" in output)) return output;
  const { usage, ...rest } = output as { usage: unknown };
  if (isOutputUsage(usage)) {
    await recordModelUsage({
      userId,
      part: usage.part,
      model: usage.model,
      usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedInputTokens: usage.cachedInputTokens },
      metadata: {
        conversationId,
        ...(usage.imageInputTokens !== undefined ? { imageInputTokens: usage.imageInputTokens } : {}),
      },
    });
  }
  return rest;
}

/** An image the read tool returned. The model gets the picture itself, not its base64 text. */
interface ImageResult {
  kind: "image";
  path: string;
  mediaType: string;
  base64: string;
}

function isImageResult(output: unknown): output is ImageResult {
  return (
    typeof output === "object" &&
    output !== null &&
    (output as { kind?: unknown }).kind === "image" &&
    typeof (output as { base64?: unknown }).base64 === "string"
  );
}

function toModelOutput(output: unknown) {
  if (isImageResult(output)) {
    return {
      type: "content" as const,
      value: [
        { type: "text" as const, text: `Image ${output.path}` },
        {
          type: "file" as const,
          data: { type: "data" as const, data: output.base64 },
          mediaType: output.mediaType,
        },
      ],
    };
  }
  return { type: "json" as const, value: (output ?? null) as JSONValue };
}
