import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getConfig } from "../config";
import { renameUntitledConversation } from "../repositories/conversation-repository";

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
/** The naming model only needs the start of the first message. */
const MAX_INPUT_CHARS = 2000;

/**
 * Names a new conversation from its first message with one short model call, then stores the name over the
 * placeholder title. Resolves to the stored name, or undefined when nothing was named.
 *
 * Never rejects. Naming is best effort: when it fails, the placeholder title stays. The caller starts it without
 * awaiting it, so the agent's reply never waits for it.
 */
export async function nameConversation(params: {
  conversationId: string;
  userId: string;
  placeholderTitle: string;
  firstMessage: string;
}): Promise<string | undefined> {
  const { conversationId, userId, placeholderTitle, firstMessage } = params;
  try {
    const { text } = await generateText({
      model: anthropic(getConfig().TITLE_MODEL),
      system: loadConversationTitlePrompt(),
      prompt: firstMessage.slice(0, MAX_INPUT_CHARS),
      maxOutputTokens: 32,
    });
    const title = cleanTitle(text);
    if (!title) return undefined;
    const renamed = await renameUntitledConversation(conversationId, userId, placeholderTitle, title);
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
