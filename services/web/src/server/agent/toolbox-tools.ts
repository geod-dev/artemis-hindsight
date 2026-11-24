import { jsonSchema, tool, type JSONValue, type ToolSet } from "ai";
import { z } from "zod";
import { invokeToolboxTool, listToolboxTools } from "../clients/toolbox-client";
import { recordModelCall } from "../usage/model-calls";

/** The toolbox's memory tools (services/toolbox/src/tools/memory.ts). They read the user's Hindsight bank. */
const MEMORY_TOOLS = new Set(["recall", "reflect"]);

/**
 * Turns the toolbox registry into AI SDK tools for one conversation.
 * Every tool call is forwarded to the toolbox with the conversation id as the sandbox session and the user's
 * username, which the memory tools use as their Hindsight bank. Without a username (an unpersonalized temporary chat),
 * the memory tools are left out and the toolbox is never told who the user is.
 *
 * A tool that called a model (generate_image) puts the provider's usage under `usage` in its output: the call is
 * recorded in the ledger against the reply being written (`messageId`), and `usage` is taken out of the output before the
 * model reads it.
 */
export async function buildToolboxTools(
  sessionId: string,
  username: string | null,
  userId: string,
  messageId: string,
): Promise<ToolSet> {
  const definitions = (await listToolboxTools()).filter((definition) => username || !MEMORY_TOOLS.has(definition.name));

  const entries = definitions.map((definition) => [
    definition.name,
    tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (input: unknown) => {
        const result = await invokeToolboxTool(definition.name, input, { sessionId, ...(username ? { username } : {}) });
        if (!result.ok) throw new Error(result.error);
        return takeUsage(result.output, { userId, conversationId: sessionId, messageId });
      },
      toModelOutput: ({ output }) => toModelOutput(output),
    }),
  ]);

  return Object.fromEntries(entries);
}

/**
 * The `usage` a tool's output may carry: OpenAI's usage for an image (services/toolbox/src/tools/generate-image.ts), as
 * the Images API returned it. Memory is not here: Hindsight's calls are copied from its own request log.
 */
const toolUsage = z.object({
  provider: z.literal("openai"),
  model: z.string(),
  requestId: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number(),
    input_tokens_details: z.object({ text_tokens: z.number(), image_tokens: z.number() }),
    output_tokens: z.number(),
    output_tokens_details: z.object({ text_tokens: z.number(), image_tokens: z.number() }).optional(),
  }),
});

/** Records the `usage` of a tool's output, and returns the output without it: the model never reads token counts. */
async function takeUsage(
  output: unknown,
  owner: { userId: string; conversationId: string; messageId: string },
): Promise<unknown> {
  if (typeof output !== "object" || output === null || !("usage" in output)) return output;
  const { usage, ...rest } = output as { usage: unknown };
  const parsed = toolUsage.safeParse(usage);
  if (!parsed.success) {
    console.warn("tool usage not recorded: unexpected shape", { issues: parsed.error.issues.length });
    return rest;
  }
  const { model, requestId, usage: tokens } = parsed.data;
  // Without a split of the output, every output token is an image token: the image models bill no text output.
  const outputDetails = tokens.output_tokens_details ?? { text_tokens: 0, image_tokens: tokens.output_tokens };
  await recordModelCall({
    userId: owner.userId,
    sourceKey: `openai:${requestId ?? crypto.randomUUID()}`,
    context: "image",
    operation: "generate",
    cause: "tool_call",
    model,
    tokens: {
      input: tokens.input_tokens_details.text_tokens,
      imageInput: tokens.input_tokens_details.image_tokens,
      output: outputDetails.text_tokens,
      imageOutput: outputDetails.image_tokens,
    },
    conversationId: owner.conversationId,
    messageId: owner.messageId,
  });
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
