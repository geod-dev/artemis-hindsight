import { z } from "zod";
import type { HindsightClient } from "../hindsight-client.js";
import type { Tool, ToolContext } from "../registry.js";

// The memory tools work on the bank of the user the conversation belongs to. The web app sends the username
// with every tool call, so a conversation can only reach its own user's memory.

const retainInput = z.object({
  content: z
    .string()
    .min(1)
    .max(8_000)
    .describe("What to remember, written as complete sentences with the people, dates and facts it needs."),
  context: z
    .string()
    .max(200)
    .optional()
    .describe("A short label for what kind of memory this is, e.g. 'family' or 'project'."),
});

const queryInput = z.object({
  query: z.string().min(1).max(1_000).describe("The question or the subject to look up in the user's memory."),
});

function bankOf(ctx: ToolContext): string {
  if (!ctx.username) throw new Error("memory is only available in a user's conversation");
  return ctx.username;
}

export function createMemoryTools(hindsight: HindsightClient): Tool<z.ZodType>[] {
  const retain: Tool<typeof retainInput> = {
    name: "retain",
    description:
      "Save something to the user's long-term memory, so you still know it in later conversations. " +
      "Use it for facts the user shares about themselves, their family, their projects or their preferences. " +
      "Memories are extracted in the background, so they can take a moment to show up in recall. " +
      "Refer to the person you are talking with as \"user\". Use a name only for other people.",
    input: retainInput,
    async run({ content, context }, ctx) {
      await hindsight.retain(bankOf(ctx), content, context);
      return { stored: true };
    },
  };

  const recall: Tool<typeof queryInput> = {
    name: "recall",
    description:
      "Search the user's long-term memory for facts related to a query and get them back as a list. " +
      "Use it to look up specific facts. For a synthesized answer across several memories, use reflect.",
    input: queryInput,
    async run({ query }, ctx) {
      const facts = await hindsight.recall(bankOf(ctx), query);
      return { facts };
    },
  };

  const reflect: Tool<typeof queryInput> = {
    name: "reflect",
    description:
      "Ask the user's long-term memory a question that needs reasoning across several memories, and get a grounded " +
      "answer with the memories it relied on. Slower than recall; use it for questions like 'what do I know about X'.",
    input: queryInput,
    async run({ query }, ctx) {
      return hindsight.reflect(bankOf(ctx), query);
    },
  };

  return [retain, recall, reflect];
}
