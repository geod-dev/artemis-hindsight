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
} from "ai";
import { getConfig } from "../config";
import { recallMemories } from "../clients/hindsight-client";
import { injectQuoteContext } from "@assistant-ui/ai-sdk";
import type { StoredMessageMetadata, TurnTiming } from "@/server/db/schema";
import { ensureConversation, touchConversation } from "../repositories/conversation-repository";
import { listMessages, saveMessage, type MessageRow } from "../repositories/message-repository";
import { checkAttachments } from "./attachments";
import { toModelHistory } from "./model-history";
import { textOf, type MemoryLookup } from "./memory-context";
import { SYSTEM_PROMPT } from "./system-prompt";
import { buildToolboxTools } from "./toolbox-tools";
import { createTurnTiming, observeTurnTiming, snapshotTiming } from "./turn-timing";
import { endTurn, resumable, startTurn } from "./turn-registry";

/**
 * Handles one user message in a conversation. The turn is owned by the server: it keeps running when
 * the browser disconnects or reloads, and the browser reads it back through the resumable stream.
 *
 * Order of work:
 *   1. check the attachments: they must be uploaded to this conversation and still exist in the sandbox
 *   2. create the conversation if it is new
 *   3. recall memory for the user's text (best effort; a failure never blocks the chat)
 *   4. store the user message, with its attachment paths and the memory it was enriched with
 *   5. load the full history from the database, the source of truth, and build the model input
 *   6. stream the model response into the resumable store; every completed step is written to the database
 *
 * Returns the stream of this turn, and the stream id the browser keeps to reconnect after a reload.
 */
export async function runChatTurn(params: { conversationId: string; incoming: UIMessage }): Promise<Response> {
  const { conversationId, incoming } = params;
  const config = getConfig();
  const userText = textOf(incoming);

  const parts = await checkAttachments(conversationId, incoming.parts);
  await ensureConversation(conversationId, userText);

  const lookup = await lookupMemory(userText);

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
        facts: lookup.status === "ok" ? lookup.facts : [],
      },
      ...(custom ? { custom } : {}),
    },
    status: "complete",
  });

  const history = (await listMessages(conversationId)).map(toUIMessage);
  const modelHistory = await toModelHistory(conversationId, history, lookup);
  // A quoted message reaches the model as a blockquote in front of its text.
  const modelMessages = await convertToModelMessages(injectQuoteContext(modelHistory));

  // Resolved before streaming starts, so a toolbox outage returns a clear error instead of a half-started reply.
  const tools = await buildToolboxTools(conversationId);

  const streamId = crypto.randomUUID();
  const turn = startTurn(conversationId, streamId);
  const timing = createTurnTiming(Date.now());

  const uiStream = createUIMessageStream<UIMessage>({
    originalMessages: history,
    generateId: () => crypto.randomUUID(),
    execute: ({ writer }) => {
      const result = streamText({
        model: anthropic(config.CHAT_MODEL),
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(config.MAX_AGENT_STEPS),
        abortSignal: turn.abort.signal,
      });
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

async function lookupMemory(query: string): Promise<MemoryLookup> {
  const budget = getConfig().MEMORY_RECALL_BUDGET;
  try {
    const facts = await recallMemories(query);
    return { status: "ok", query, budget, facts };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("memory recall unavailable", { reason });
    return { status: "unavailable", query, budget, reason };
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
