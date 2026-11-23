import type { UIMessage } from "ai";
import { z } from "zod";
import { TEMPORARY_MODES } from "@/lib/temporary-chat";
import { runChatTurn } from "@/server/agent/chat-turn";
import { AttachmentError } from "@/server/agent/attachments";
import { getCurrentUser, unauthorized } from "@/server/auth/session";
import { ConversationOwnershipError } from "@/server/repositories/conversation-repository";
import { ProjectServiceError } from "@/server/projects/project-service";

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
  // The AI SDK's reason for the request: a new or edited message, or a new reply to the last user message.
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  // With a regenerate: the stopped reply to continue (the Continue button under a stopped reply).
  continueMessageId: z.string().min(1).nullable().optional(),
  // Model context settings from the composer. Only the reasoning effort is used.
  config: z.object({ reasoningEffort: z.enum(["low", "medium", "high"]).optional() }).optional(),
  // The project selected in the new chat. Used when this message creates the conversation.
  projectId: z.uuid().nullable().optional(),
  // The temporary mode selected in the new chat, or null for a normal chat. Used when this message creates the conversation.
  temporary: z.enum(TEMPORARY_MODES).nullable().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

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
      // The messages are the client's branch: the one before the incoming message is its parent. An edit sends the
      // branch up to the edited message's parent, so the edit is stored beside the message it replaces.
      parentId: parsed.data.messages.at(-2)?.id ?? null,
      regenerate: parsed.data.trigger === "regenerate-message",
      continueMessageId: parsed.data.continueMessageId ?? null,
      reasoningEffort: parsed.data.config?.reasoningEffort,
      projectId: parsed.data.projectId,
      temporary: parsed.data.temporary,
      user,
    });
  } catch (error) {
    if (error instanceof AttachmentError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConversationOwnershipError) {
      return Response.json({ error: "conversation not found" }, { status: 404 });
    }
    if (error instanceof ProjectServiceError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("failed to start chat turn", error);
    return Response.json({ error: "the chat service is unavailable" }, { status: 503 });
  }
}
