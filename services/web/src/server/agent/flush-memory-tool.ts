import { tool } from "ai";
import { z } from "zod";

/**
 * The agent's flush_memory tool. Conversations are saved to memory in the background: when the user switches to another
 * conversation, or after an hour without a message. This tool asks for the save now instead, at the end of the reply.
 * The flush runs when the turn ends (see chat-turn.ts), after the reply is stored, so its messages are marked as saved
 * and are not sent again later.
 */
export function flushMemoryTool(onCalled: () => void) {
  return tool({
    description:
      "Save this conversation to the long-term memory. " +
      "Use it when the user asks you to remember something now. " +
      "Do not call it for every message: conversations are saved on their own.",
    inputSchema: z.object({}),
    execute: async () => {
      onCalled();
      return { message: "Conversation will be saved at the end of your reply. You can tell user it's been saved." };
    },
  });
}
