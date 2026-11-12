import { jsonSchema, tool, type JSONValue, type ToolSet } from "ai";
import { invokeToolboxTool, listToolboxTools } from "../clients/toolbox-client";

/**
 * Turns the toolbox registry into AI SDK tools for one conversation.
 * Every tool call is forwarded to the toolbox with the conversation id as the sandbox session and the user's
 * username, which the memory tools use as their Hindsight bank.
 */
export async function buildToolboxTools(sessionId: string, username: string): Promise<ToolSet> {
  const definitions = await listToolboxTools();

  const entries = definitions.map((definition) => [
    definition.name,
    tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (input: unknown) => {
        const result = await invokeToolboxTool(definition.name, input, { sessionId, username });
        if (!result.ok) throw new Error(result.error);
        return result.output;
      },
      toModelOutput: ({ output }) => toModelOutput(output),
    }),
  ]);

  return Object.fromEntries(entries);
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
