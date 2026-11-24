import { anthropic } from "@ai-sdk/anthropic";
import { generateText, type UIMessage } from "ai";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getConfig } from "../config";
import { renameUntitledConversation, setConversationTitle } from "../repositories/conversation-repository";
import { recordModelCall, tokensOfLanguageModel } from "../usage/model-calls";

// The naming prompt lives in prompts/conversation-title.md so it can be reviewed and edited without touching code.
// Same caching as the system prompt: read on every call in development, once per process in production.
const PROMPT_FILE = path.join(process.cwd(), "prompts", "conversation-title.md");

let cached: string | undefined;

export function loadConversationTitlePrompt(): string {
  if (process.env.NODE_ENV !== "production") {
    return readFileSync(PROMPT_FILE, "utf8").trim();
  }
  if (cached === undefined) {
    cached = readFileSync(PROMPT_FILE, "utf8").trim();
  }
  return cached;
}

/** The same limit the placeholder title uses, so a generated name never looks longer than a first message. */
const MAX_TITLE_LENGTH = 60;
/** The most JSON the naming model reads. A long conversation keeps its latest messages: they say best what it is about. */
const NAMING_INPUT_CHARS = 2000;
/** The most text kept from one message, so one long message does not push out all the others. */
const NAMING_MESSAGE_CHARS = 1000;

/**
 * One message as the naming model reads it: what the user typed or the agent replied, and the names of the files the
 * user attached. Stored messages hold no context tags (those are added for the agent in model-history.ts), and file
 * contents are never sent.
 */
export interface NamingMessage {
  role: "user" | "assistant";
  text: string;
  files?: string[];
}

/**
 * The messages to name a conversation from: its user and assistant messages in order, each cut to its start, then
 * the latest ones that fit in the naming budget. Empty when no user message has text (a conversation opened with only a
 * file is named on the first message that says something).
 */
export function namingMessages(history: Pick<UIMessage, "role" | "parts">[]): NamingMessage[] {
  const all: NamingMessage[] = [];
  for (const message of history) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("")
      .trim()
      .slice(0, NAMING_MESSAGE_CHARS);
    const files = message.parts.flatMap((part) => (part.type === "file" && part.filename ? [part.filename] : []));
    if (!text && files.length === 0) continue;
    all.push({ role: message.role, text, ...(files.length > 0 ? { files } : {}) });
  }
  if (!all.some((message) => message.role === "user" && message.text)) return [];
  const kept: NamingMessage[] = [];
  let size = 2;
  for (const message of [...all].reverse()) {
    size += JSON.stringify(message).length + 1;
    if (kept.length > 0 && size > NAMING_INPUT_CHARS) break;
    kept.unshift(message);
  }
  return kept;
}

/**
 * Names a conversation from its messages with one short model call, then stores the name. The messages are sent as
 * JSON under a question, so the model reads them as text to name, never as a request to answer. With
 * `placeholderTitle`, the name only replaces that placeholder (a new conversation named from its first message).
 * Without it, the name replaces the current title (the user asked for a new name).
 * Resolves to the stored name, or undefined when nothing was named.
 *
 * `cause` is why the name is asked for: a new conversation, or the user (rename, name the untitled conversations).
 *
 * Never rejects. Naming is best effort: when it fails, the title stays. A turn starts it without awaiting it, so the
 * agent's reply never waits for it.
 */
export async function nameConversation(params: {
  conversationId: string;
  userId: string;
  placeholderTitle?: string;
  messages: NamingMessage[];
  cause: "conversation_created" | "user_action";
}): Promise<string | undefined> {
  const { conversationId, userId, placeholderTitle, messages, cause } = params;
  try {
    const { text, usage, response, finishReason } = await generateText({
      model: anthropic(getConfig().TITLE_MODEL),
      system: loadConversationTitlePrompt(),
      prompt: `What's the title of this conversation?\n\n${JSON.stringify(messages)}`,
      maxOutputTokens: 32,
      // An overloaded or rate-limited answer is retried before giving up. A later turn tries again if all fail.
      maxRetries: 4,
    });
    await recordModelCall({
      userId,
      sourceKey: `anthropic:${response.id}`,
      context: "title",
      operation: "generate",
      cause,
      model: response.modelId,
      tokens: tokensOfLanguageModel(usage),
      conversationId,
    });
    const title = cleanTitle(text);
    if (!title) {
      console.warn("conversation naming failed", { conversationId, reason: "empty title", finishReason, text });
      return undefined;
    }
    const renamed =
      placeholderTitle === undefined
        ? await setConversationTitle(conversationId, userId, title)
        : await renameUntitledConversation(conversationId, userId, placeholderTitle, title);
    if (!renamed) console.warn("conversation naming failed", { conversationId, reason: "title not stored", title });
    return renamed ? title : undefined;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("conversation naming failed", { conversationId, reason });
    return undefined;
  }
}

/** Keeps the first non-empty line, strips wrapping quotes and trailing punctuation, and caps the length. */
export function cleanTitle(raw: string): string {
  const line = raw.split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? "";
  const title = line
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’`*#\s]+|["'“”‘’`*.!?\s]+$/g, "");
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return `${title.slice(0, MAX_TITLE_LENGTH - 3)}...`;
}
