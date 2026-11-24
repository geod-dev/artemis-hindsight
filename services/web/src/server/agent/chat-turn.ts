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
import type { TemporaryMode } from "@/lib/temporary-chat";
import { injectQuoteContext } from "@assistant-ui/ai-sdk";
import type { StoredMessageMetadata, TurnTiming } from "@/server/db/schema";
import type { CurrentUser } from "../auth/session";
import {
  canUseConversation,
  ConversationOwnershipError,
  DEFAULT_TITLE,
  ensureConversation,
  titleFrom,
  setConversationUnread,
  touchConversation,
} from "../repositories/conversation-repository";
import { findProject } from "../repositories/project-repository";
import { ProjectServiceError } from "../projects/project-service";
import {
  advanceActiveLeaf,
  branchTo,
  listMessages,
  saveMessage,
  setActiveLeaf,
  setModelInput,
  type MessageRow,
} from "../repositories/message-repository";
import { activateConversation, flushConversation, flushIfInactive } from "../memory/memory-flush";
import { checkAttachments } from "./attachments";
import { CONTINUE_INSTRUCTION, continueInOpenText, replayReply } from "./continue-reply";
import { nameConversation } from "./conversation-title";
import { flushMemoryTool } from "./flush-memory-tool";
import { latestModelInput, loadUsableSkills, toModelHistory, type UserContext } from "./model-history";
import { textOf, type MemoryLookup } from "./memory-context";
import type { ProjectContext } from "./project-context";
import { loadSystemPrompt } from "./system-prompt";
import { buildToolboxTools } from "./toolbox-tools";
import { recordModelCall, tokensOfLanguageModel } from "../usage/model-calls";
import { createTurnTiming, observeTurnTiming, snapshotTiming } from "./turn-timing";
import { acquireTurn, endTurn, hasViewers, resumable, startTurn, watchViewers } from "./turn-registry";
import { announceListChange } from "../events/list-events";

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
 *   6. load the branch that ends at this message from the database, the source of truth, and build the model input
 *   7. stream the model response into the resumable store; every completed step is written to the database
 *   8. while the conversation still has its placeholder title, name it in the background (see naming below)
 *
 * Temporary chats are never made active, saved to memory or named. An unpersonalized one also skips step 4 and the
 * user context: the agent gets no memory, profile, workspace, skills, project or memory tools.
 *
 * Naming: the placeholder title (the first message) stays until a short model call answers with a name. That call
 * runs beside the agent and is never awaited. It runs on every turn whose conversation still carries a placeholder,
 * not only the first one: a first turn that failed before streaming (toolbox outage, restart) or a naming call that
 * failed would otherwise leave the placeholder for good. When it answers, the name is stored and also sent on this turn's
 * stream as a transient part, so the sidebar updates without a reload. If the turn has already ended, the stored
 * name shows on the next load.
 *
 * Branches: the message follows `parentId`, the message before it in the client's branch. An edit is a new user message
 * whose parent is the edited message's parent, so it starts a branch beside it. A regenerate sends an existing user
 * message again: it is not stored twice, and the new reply is a branch beside the old one. Either way the model reads only
 * the branch, and the conversation's active leaf moves to the message, then to its reply. Editing the first message
 * names the conversation again from the new text.
 *
 * Continue: a regenerate that names a reply the user stopped (`continueMessageId`, a reply to the incoming message). The
 * model reads that reply and is asked to go on with it; the turn's stream replays it and carries the rest, in the same
 * message, which is stored complete (see continue-reply.ts).
 *
 * Returns the stream of this turn, and the stream id the browser keeps to reconnect after a reload.
 */
/** The project and temporary mode the composer had selected. They only matter when this message creates the conversation. */
export interface ChatTurnParams {
  conversationId: string;
  incoming: UIMessage;
  /** The message the incoming one follows in the client's branch, or null when it is the first message. */
  parentId: string | null;
  /** True when the client asks for a new reply to a user message that is already stored. */
  regenerate: boolean;
  /** With `regenerate`: the stopped reply to continue instead of answering again. */
  continueMessageId?: string | null;
  reasoningEffort?: "low" | "medium" | "high";
  projectId?: string | null;
  temporary?: TemporaryMode | null;
  user: CurrentUser;
}

export async function runChatTurn(params: ChatTurnParams): Promise<Response> {
  // A message sent while a reply runs in this conversation waits for that reply to end, then starts its own turn.
  const release = await acquireTurn(params.conversationId);
  try {
    return await startChatTurn(params, release);
  } catch (error) {
    release();
    throw error;
  }
}

async function startChatTurn(params: ChatTurnParams, release: () => void): Promise<Response> {
  const { conversationId, incoming, user } = params;
  // The composer's Low / Medium / High choice. Medium when the browser sends none.
  const reasoningEffort = params.reasoningEffort ?? "medium";
  const config = getConfig();
  const userText = textOf(incoming);

  if (!(await canUseConversation(conversationId, user.id))) {
    throw new ConversationOwnershipError("conversation belongs to another user");
  }
  // A project named by the browser must be one of the user's. Checked on every message, so a foreign id is refused.
  if (params.projectId && !(await findProject(params.projectId, user.id))) {
    throw new ProjectServiceError("project not found", 404);
  }
  const parts = await checkAttachments(conversationId, incoming.parts);
  // A new conversation takes the requested project and temporary mode. An existing one keeps those it was created with.
  const conversation = await ensureConversation(conversationId, user.id, userText, {
    projectId: params.projectId ?? null,
    temporary: params.temporary ?? null,
  });
  const { temporary } = conversation;
  const personalized = temporary !== "unpersonalized";
  const project = conversation.projectId ? (await findProject(conversation.projectId, user.id)) ?? null : null;
  // Sending from a client means the user is looking at this conversation: it is read.
  await setConversationUnread(conversationId, user.id, false);

  const context = personalized ? await loadUserContext(user, userText, project) : null;

  const custom = (incoming.metadata as { custom?: StoredMessageMetadata["custom"] } | undefined)?.custom;

  const stored = await listMessages(conversationId);
  const existing = stored.find((row) => row.id === incoming.id);
  // A regenerate names a user message that is already stored: it keeps its content, its parent and its metadata.
  const regenerate = params.regenerate && existing?.role === "user";
  const parentId = existing ? existing.parentId : parentOf(stored, params.parentId, conversation.activeLeafId);
  // The stopped reply to go on with: it must answer the incoming message. Anything else is a plain regenerate.
  const stoppedRow =
    regenerate && params.continueMessageId
      ? stored.find(
          (row) => row.id === params.continueMessageId && row.role === "assistant" && row.parentId === incoming.id,
        )
      : undefined;
  const stopped = stoppedRow ? toUIMessage(stoppedRow) : undefined;
  // A new first message beside an existing one: the first message was edited, so the conversation is named again.
  const editsFirstMessage = !existing && parentId === null && stored.some((row) => row.parentId === null);

  if (!regenerate) {
    await saveMessage({
      id: incoming.id,
      conversationId,
      parentId,
      role: "user",
      parts,
      metadata: {
        ...(context ? { memory: memoryMetadata(context.lookup) } : {}),
        ...(custom ? { custom } : {}),
        reasoningEffort,
      },
      status: "complete",
    });
  }
  // The branch the user is on now ends at this message, until its reply replaces it (see persistLatestAssistant).
  await setActiveLeaf(conversationId, incoming.id);
  // This conversation is now the user's active one. The previous active conversation is flushed to memory in the background.
  // A temporary chat never becomes active: it is never saved to memory.
  if (!temporary) await activateConversation(user.id, user.username, conversationId);

  const history = branchTo(await listMessages(conversationId), incoming.id).map(toUIMessage);
  const naming = temporary
    ? undefined
    : editsFirstMessage
      ? userText || undefined
      : namingInput(conversation.title, history);
  // Continuing: the model reads its stopped reply, then the request to go on with it.
  const modelHistory = await toModelHistory(conversationId, stopped ? [...history, stopped] : history, context, temporary);
  // A quoted message reaches the model as a blockquote in front of its text.
  const quotedHistory = [
    ...injectQuoteContext(modelHistory),
    ...(stopped
      ? [{ id: "continue", role: "user" as const, parts: [{ type: "text" as const, text: CONTINUE_INSTRUCTION }] }]
      : []),
  ];
  // Kept for the message's debug view, exactly as the model reads it. Best effort: a failure never blocks the reply.
  // A continuation keeps the input of the first answer.
  const modelInput = stopped ? undefined : latestModelInput(quotedHistory);
  if (modelInput) {
    try {
      await setModelInput(incoming.id, modelInput);
    } catch (error) {
      console.warn("saving the model input failed", { reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const modelMessages = await convertToModelMessages(quotedHistory);

  // The reply's id, chosen now so every model call of the turn (its steps, an image a tool makes) is recorded against it.
  // A continuation goes on in the stopped reply.
  const replyId = stopped?.id ?? crypto.randomUUID();
  // Resolved before streaming starts, so a toolbox outage returns a clear error instead of a half-started reply.
  const toolboxTools = await buildToolboxTools(conversationId, personalized ? user.username : null, user.id, replyId);
  // The flush tool only asks for a save: the conversation is saved when this reply ends (see onEnd). A temporary chat,
  // never saved, does not get it.
  let memoryFlushRequested = false;
  const tools = temporary
    ? toolboxTools
    : {
        ...toolboxTools,
        flush_memory: flushMemoryTool(() => {
          memoryFlushRequested = true;
        }),
      };

  const streamId = crypto.randomUUID();
  const turn = startTurn(conversationId, streamId, user.id);
  // The lists show the running spinner from the start of the turn, so they are read again now.
  announceListChange(user.id);
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
        // cacheControl is Anthropic's automatic prompt caching: each step reads the prompt the step before it wrote.
        providerOptions: {
          anthropic: {
            effort: reasoningEffort,
            thinking: { type: "adaptive", display: "summarized" },
            cacheControl: { type: "ephemeral" },
          },
        },
        // Each step is one request to the model, recorded with the usage the API reported for it.
        onStepEnd: (step) =>
          recordModelCall({
            userId: user.id,
            sourceKey: `anthropic:${step.response.id}`,
            context: "conversation",
            operation: "generate",
            cause: "message_sent",
            model: step.response.modelId,
            tokens: tokensOfLanguageModel(step.usage),
            conversationId,
            messageId: replyId,
          }),
      });
      if (naming) {
        // Not awaited: the agent's reply never waits for the name. The name is announced on this stream if it is still open.
        void nameConversation({
          conversationId,
          userId: user.id,
          placeholderTitle: conversation.title,
          firstMessage: naming,
          cause: "conversation_created",
        }).then((title) => {
          if (title) announceTitle(writer, title);
        });
      }
      // Every timing change is sent to the browser as message metadata, so it shows without a reload.
      const observed = observeTurnTiming(result.stream, timing, () =>
        writer.write({ type: "message-metadata", messageMetadata: { turnTiming: snapshotTiming(timing) } }),
      );
      const messageMetadata = ({ part }: { part: { type: string } }) => {
        if (part.type === "finish") timing.endedAt = Date.now();
        return part.type === "start" || part.type === "finish" ? { turnTiming: snapshotTiming(timing) } : undefined;
      };
      if (!stopped) {
        writer.merge(toUIMessageStream({ stream: observed, messageMetadata, generateMessageId: () => replyId }));
        return;
      }
      // Continuing: the reply opens under the stopped reply's id with what it had, then the model goes on with it.
      writer.write({ type: "start", messageId: stopped.id, messageMetadata: { turnTiming: snapshotTiming(timing) } });
      const replayed = replayReply(writer, stopped);
      writer.merge(
        toUIMessageStream({ stream: observed, messageMetadata, sendStart: false }).pipeThrough(continueInOpenText(replayed)),
      );
    },
    onStepEnd: async ({ messages }) => {
      await persistLatestAssistant(
        conversationId,
        incoming.id,
        messages,
        "streaming",
        snapshotTiming(timing),
      );
    },
    onEnd: async ({ messages, isAborted }) => {
      timing.endedAt ??= Date.now();
      await persistLatestAssistant(
        conversationId,
        incoming.id,
        messages,
        isAborted ? "aborted" : "complete",
        snapshotTiming(timing),
      );
      await touchConversation(conversationId, user.id);
      // A reply that finished with nobody connected to read it is unread. With a client connected, it was read.
      const delivered = hasViewers(streamId);
      await setConversationUnread(conversationId, user.id, !delivered);
      endTurn(conversationId, streamId);
      // After endTurn: a list read on this announcement must no longer see the turn as running.
      announceListChange(user.id);
      release();
      // Not awaited. A reply that called flush_memory saves its conversation now, the reply being stored above. Otherwise,
      // if another conversation took over while this turn streamed, its messages reach memory now.
      if (temporary) return;
      if (memoryFlushRequested) void flushConversation(conversationId, user.username);
      else void flushIfInactive(user.id, user.username, conversationId);
    },
    onError: (error) => {
      console.error("chat turn failed", { conversationId, error });
      return "The agent hit an error while answering. Please try again.";
    },
  });

  // The producer writes the stream into the resumable store; the response reads it back from there.
  const bytes = uiStream.pipeThrough(new JsonToSseTransformStream()).pipeThrough(new TextEncoderStream());
  const body = watchViewers(streamId, await resumable.run(streamId, () => bytes));
  return new Response(body, {
    headers: { ...UI_MESSAGE_STREAM_HEADERS, [RESUMABLE_STREAM_ID_HEADER]: streamId },
  });
}

/**
 * The text to name the conversation from, or undefined when it already has a real name. The title is a placeholder
 * when it is the default one or the one a user message of this conversation gives (see `ensureConversation`). The
 * name comes from the first user message with text, so a conversation opened with only a file is named on the first
 * message that says something.
 */
function namingInput(title: string, history: UIMessage[]): string | undefined {
  const userTexts = history.filter((message) => message.role === "user").map(textOf);
  const isPlaceholder = title === DEFAULT_TITLE || userTexts.some((text) => titleFrom(text) === title);
  if (!isPlaceholder) return undefined;
  return userTexts.find(Boolean);
}

/**
 * The stored parent of a new message: the one the client names when it is stored in this conversation, none when the
 * client sends a first message. A parent the server does not know (a message that never reached it) falls back to the
 * end of the branch the conversation is on, so the message is never stored outside the tree.
 */
function parentOf(stored: MessageRow[], requested: string | null, activeLeafId: string | null): string | null {
  if (requested === null) return null;
  if (stored.some((row) => row.id === requested)) return requested;
  return activeLeafId && stored.some((row) => row.id === activeLeafId) ? activeLeafId : (stored.at(-1)?.id ?? null);
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

/** What the agent is told about the user for this message: profile, recalled memory, skills and project. */
async function loadUserContext(user: CurrentUser, userText: string, project: ProjectContext | null): Promise<UserContext> {
  const [lookup, skills] = await Promise.all([lookupMemory(user.username, userText), loadUsableSkills(user.username)]);
  return { user, lookup, skills, project };
}

/** The memory lookup as the user message stores it, for the message's debug view. */
function memoryMetadata(lookup: MemoryLookup): NonNullable<StoredMessageMetadata["memory"]> {
  return {
    query: lookup.query,
    budget: lookup.budget,
    status: lookup.status,
    durationMs: lookup.durationMs,
    ...(lookup.status === "unavailable" ? { reason: lookup.reason } : {}),
    facts: lookup.status === "ok" ? lookup.facts : [],
  };
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

/**
 * Stores the reply to `userMessageId`: the assistant message after it in the stream's messages. Its parent is that user
 * message, and the conversation's active leaf moves from the user message to the reply.
 */
async function persistLatestAssistant(
  conversationId: string,
  userMessageId: string,
  all: UIMessage[],
  status: "streaming" | "complete" | "aborted",
  turnTiming: TurnTiming,
): Promise<void> {
  const after = all.slice(all.findIndex((message) => message.id === userMessageId) + 1);
  const latest = after.findLast((message) => message.role === "assistant");
  if (!latest) return;
  await saveMessage({
    id: latest.id,
    conversationId,
    parentId: userMessageId,
    role: "assistant",
    parts: latest.parts,
    metadata: { model: getConfig().CHAT_MODEL, turnTiming },
    status,
  });
  await advanceActiveLeaf(conversationId, userMessageId, latest.id);
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
