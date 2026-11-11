import type { UIMessage } from "ai";
import { z } from "zod";
import { runChatTurn } from "@/server/agent/chat-turn";
import { AttachmentError } from "@/server/agent/attachments";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  id: z.uuid(),
  messages: z.array(
    z.custom<UIMessage>(
      (value) => typeof value === "object" && value !== null && "role" in value && "parts" in value,
      "expected a UI message",
    ),
  ),
  // Model context settings from the composer. Only the reasoning effort is used.
  config: z.object({ reasoningEffort: z.enum(["low", "medium", "high"]).optional() }).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("rejected chat request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    return Response.json({ error: "invalid chat request" }, { status: 400 });
  }

  const incoming = parsed.data.messages.at(-1);
  if (!incoming || incoming.role !== "user") {
    console.warn("rejected chat request: last message is not from the user", { id: parsed.data.id });
    return Response.json({ error: "the last message must be from the user" }, { status: 400 });
  }

  try {
    // The turn is not tied to this request: closing or reloading the page does not stop the agent.
    return await runChatTurn({
      conversationId: parsed.data.id,
      incoming,
      reasoningEffort: parsed.data.config?.reasoningEffort,
    });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("failed to start chat turn", error);
    return Response.json({ error: "the chat service is unavailable" }, { status: 503 });
  }
}
