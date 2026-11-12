import { anthropic } from "@ai-sdk/anthropic";
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  stepCountIs,
  streamText,
  toUIMessageStream,
  UI_MESSAGE_STREAM_HEADERS,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { getConfig } from "../config";
import { recallMemories } from "../clients/hindsight-client";
import { CONVERSATION_TITLE_PART, type ConversationTitleData } from "@/lib/conversation-title-part";
import { injectQuoteContext } from "@assistant-ui/ai-sdk";
import type { StoredMessageMetadata, TurnTiming } from "@/server/db/schema";
import type { CurrentUser } from "../auth/session";
import {
  canUseConversation,
  ConversationOwnershipError,
  ensureConversation,
  touchConversation,
} from "../repositories/conversation-repository";
import { listMessages, saveMessage, setModelInput, type MessageRow } from "../repositories/message-repository";
import { activateConversation, flushIfInactive } from "../memory/memory-flush";
import { checkAttachments } from "./attachments";
import { nameConversation } from "./conversation-title";
import { latestModelInput, toModelHistory } from "./model-history";
import { textOf, type MemoryLookup } from "./memory-context";
import { loadSystemPrompt } from "./system-prompt";
import { buildToolboxTools } from "./toolbox-tools";
import { createTurnTiming, observeTurnTiming, snapshotTiming } from "./turn-timing";
import { endTurn, resumable, startTurn } from "./turn-registry";

/**
 * Handles one user message in a conversation. The turn is owned by the server: it keeps running when
 * the browser disconnects or reloads, and the browser reads it back through the resumable stream.
 *
 * Order of work:
 *   1. check the conversation belongs to this user (or is new): another user's conversation is refused
 *   2. check the attachments: they must be uploaded to this conversation and still exist in the sandbox
 *   3. create the conversation if it is new
 *   4. recall memory from the user's bank for the user's text (best effort; a failure never blocks the chat)
 *   5. store the user message, with its attachment paths and the memory it was enriched with; the conversation becomes
 *      the user's active one, and the previous active conversation is flushed to memory in the background
 *   6. load the full history from the database, the source of truth, and build the model input
 *   7. stream the model response into the resumable store; every completed step is written to the database
 *   8. when the conversation was just created, name it in the background (see naming below)
 *
 * Naming: the placeholder title (the first message) stays until a short model call answers with a name. That call
 * runs beside the agent and is never awaited. When it answers, the name is stored and also sent on this turn's
 * stream as a transient part, so the sidebar updates without a reload. If the turn has already ended, the stored
 * name shows on the next load.
 *
 * Returns the stream of this turn, and the stream id the browser keeps to reconnect after a reload.
 */
export async function runChatTurn(params: {
  conversationId: string;
  incoming: UIMessage;
  reasoningEffort?: "low" | "medium" | "high";
  user: CurrentUser;
}): Promise<Response> {
  const { conversationId, incoming, user } = params;
  // The composer's Low / Medium / High choice. Medium when the browser sends none.
  const reasoningEffort = params.reasoningEffort ?? "medium";
  const config = getConfig();
  const userText = textOf(incoming);

  if (!(await canUseConversation(conversationId, user.id))) {
    throw new ConversationOwnershipError("conversation belongs to another user");
  }
  const parts = await checkAttachments(conversationId, incoming.parts);
  const conversation = await ensureConversation(conversationId, user.id, userText);

  const lookup = await lookupMemory(user.username, userText);

  const custom = (incoming.metadata as { custom?: StoredMessageMetadata["custom"] } | undefined)?.custom;

  await saveMessage({
    id: incoming.id,
    conversationId,
    role: "user",
    parts,
    metadata: {
      memory: {
        query: lookup.query,
        budget: lookup.budget,
        status: lookup.status,
        durationMs: lookup.durationMs,
        ...(lookup.status === "unavailable" ? { reason: lookup.reason } : {}),
        facts: lookup.status === "ok" ? lookup.facts : [],
      },
      ...(custom ? { custom } : {}),
    },
    status: "complete",
  });
  // This conversation is now the user's active one. The previous active conversation is flushed to memory in the background.
  await activateConversation(user.id, user.username, conversationId);

  const history = (await listMessages(conversationId)).map(toUIMessage);
  const modelHistory = await toModelHistory(conversationId, history, lookup, user);
  // A quoted message reaches the model as a blockquote in front of its text.
  const quotedHistory = injectQuoteContext(modelHistory);
  // Kept for the message's debug view, exactly as the model reads it. Best effort: a failure never blocks the reply.
  const modelInput = latestModelInput(quotedHistory);
  if (modelInput) {
    try {
      await setModelInput(incoming.id, modelInput);
    } catch (error) {
      console.warn("saving the model input failed", { reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const modelMessages = await convertToModelMessages(quotedHistory);

  // Resolved before streaming starts, so a toolbox outage returns a clear error instead of a half-started reply.
  const tools = await buildToolboxTools(conversationId, user.username);

  const streamId = crypto.randomUUID();
  const turn = startTurn(conversationId, streamId, user.id);
  const timing = createTurnTiming(Date.now());

  const uiStream = createUIMessageStream<UIMessage>({
    originalMessages: history,
    generateId: () => crypto.randomUUID(),
    execute: ({ writer }) => {
      const result = streamText({
        model: anthropic(config.CHAT_MODEL),
        system: loadSystemPrompt(),
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(config.MAX_AGENT_STEPS),
        abortSignal: turn.abort.signal,
        // Effort only shapes thinking when thinking is on: adaptive lets the model decide how much to think.
        providerOptions: {
          anthropic: { effort: reasoningEffort, thinking: { type: "adaptive", display: "summarized" } },
        },
      });
      if (conversation.created && userText) {
        // Not awaited: the agent's reply never waits for the name. The name is announced on this stream if it is still open.
        void nameConversation({
          conversationId,
          userId: user.id,
          placeholderTitle: conversation.title,
          firstMessage: userText,
        }).then((title) => {
          if (title) announceTitle(writer, title);
        });
      }
      // Every timing change is sent to the browser as message metadata, so it shows without a reload.
      const observed = observeTurnTiming(result.stream, timing, () =>
        writer.write({ type: "message-metadata", messageMetadata: { turnTiming: snapshotTiming(timing) } }),
      );
      writer.merge(
        toUIMessageStream({
          stream: observed,
          messageMetadata: ({ part }) => {
            if (part.type === "finish") timing.endedAt = Date.now();
            return part.type === "start" || part.type === "finish"
              ? { turnTiming: snapshotTiming(timing) }
              : undefined;
          },
        }),
      );
    },
    onStepEnd: async ({ messages }) => {
      await persistLatestAssistant(conversationId, messages, "streaming", snapshotTiming(timing));
    },
    onEnd: async ({ messages, isAborted }) => {
      timing.endedAt ??= Date.now();
      await persistLatestAssistant(conversationId, messages, isAborted ? "aborted" : "complete", snapshotTiming(timing));
      await touchConversation(conversationId);
      endTurn(conversationId, streamId);
      // Not awaited. If another conversation took over while this turn streamed, its messages reach memory now.
      void flushIfInactive(user.id, user.username, conversationId);
    },
    onError: (error) => {
      console.error("chat turn failed", { conversationId, error });
      return "The agent hit an error while answering. Please try again.";
    },
  });

  // The producer writes the stream into the resumable store; the response reads it back from there.
  const bytes = uiStream.pipeThrough(new JsonToSseTransformStream()).pipeThrough(new TextEncoderStream());
  const body = await resumable.run(streamId, () => bytes);
  return new Response(body, {
    headers: { ...UI_MESSAGE_STREAM_HEADERS, [RESUMABLE_STREAM_ID_HEADER]: streamId },
  });
}

/** Sends the conversation's new name on the turn's stream. Transient: the browser reads it, the messages do not store it. */
function announceTitle(writer: UIMessageStreamWriter<UIMessage>, title: string): void {
  const data: ConversationTitleData = { title };
  try {
    writer.write({ type: CONVERSATION_TITLE_PART, data, transient: true });
  } catch {
    // The stream has already closed. The name is stored, so the sidebar shows it on the next load.
  }
}

/** Recalls the user's memory for the message. The duration covers the recall call, failed or not. */
async function lookupMemory(username: string, query: string): Promise<MemoryLookup> {
  const budget = getConfig().MEMORY_RECALL_BUDGET;
  const started = performance.now();
  try {
    const facts = await recallMemories(username, query);
    return { status: "ok", query, budget, facts, durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("memory recall unavailable", { reason });
    return { status: "unavailable", query, budget, reason, durationMs: Math.round(performance.now() - started) };
  }
}

async function persistLatestAssistant(
  conversationId: string,
  all: UIMessage[],
  status: "streaming" | "complete" | "aborted",
  turnTiming: TurnTiming,
): Promise<void> {
  const latest = [...all].reverse().find((message) => message.role === "assistant");
  if (!latest) return;
  await saveMessage({
    id: latest.id,
    conversationId,
    role: "assistant",
    parts: latest.parts,
    metadata: { model: getConfig().CHAT_MODEL, turnTiming },
    status,
  });
}

function toUIMessage(row: MessageRow): UIMessage {
  const custom = row.metadata?.custom;
  const turnTiming = row.metadata?.turnTiming;
  const metadata = {
    ...(custom ? { custom } : {}),
    ...(turnTiming ? { turnTiming } : {}),
  };
  return {
    id: row.id,
    role: row.role,
    parts: row.parts,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}
