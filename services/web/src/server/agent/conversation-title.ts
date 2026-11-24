import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
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
/**
 * The most text the naming model reads: the start of a first message, or the end of a whole conversation when the user
 * asks for a new name (regenerateTitle in conversation-service.ts cuts it from its start).
 */
export const NAMING_INPUT_CHARS = 2000;

/**
 * Names a conversation from its text with one short model call, then stores the name. With `placeholderTitle`, the name
 * only replaces that placeholder (a new conversation named from its first message). Without it, the name replaces the
 * current title (the user asked for a new name, from the user's messages of the whole conversation).
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
  firstMessage: string;
  cause: "conversation_created" | "user_action";
}): Promise<string | undefined> {
  const { conversationId, userId, placeholderTitle, firstMessage, cause } = params;
  try {
    const { text, usage, response } = await generateText({
      model: anthropic(getConfig().TITLE_MODEL),
      system: loadConversationTitlePrompt(),
      prompt: firstMessage.slice(0, NAMING_INPUT_CHARS),
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
    if (!title) return undefined;
    const renamed =
      placeholderTitle === undefined
        ? await setConversationTitle(conversationId, userId, title)
        : await renameUntitledConversation(conversationId, userId, placeholderTitle, title);
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
