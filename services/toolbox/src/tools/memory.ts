import { z } from "zod";
import type { HindsightClient } from "../hindsight-client.js";
import type { Tool, ToolContext } from "../registry.js";

// The memory tools work on the bank of the user the conversation belongs to. The web app sends the username
// with every tool call, so a conversation can only reach its own user's memory.

const queryInput = z.object({
  query: z.string().min(1).max(1_000).describe("The question or the subject to look up in the user's memory."),
});

function bankOf(ctx: ToolContext): string {
  if (!ctx.username) throw new Error("memory is only available in a user's conversation");
  return ctx.username;
}

export function createMemoryTools(hindsight: HindsightClient): Tool<z.ZodType>[] {
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
      "answer with the memories it relied on. It also reads the memory's maintained summaries of the user's profile, " +
      "family and close people, current plans and preferences. Slower than recall; use it for questions like " +
      "'what do I know about X' or 'who is in the user's family'.",
    input: queryInput,
    async run({ query }, ctx) {
      return hindsight.reflect(bankOf(ctx), query);
    },
  };

  return [recall, reflect];
}
