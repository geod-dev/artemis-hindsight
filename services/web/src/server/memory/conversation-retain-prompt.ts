import { readFileSync } from "node:fs";
import path from "node:path";

// The extraction instruction for conversation retains lives in prompts/conversation-retain.md so it can be edited
// without touching code. Same caching as the system prompt: read on every call in development, once per process in
// production.
const PROMPT_FILE = path.join(process.cwd(), "prompts", "conversation-retain.md");

let cached: string | undefined;

export function loadConversationRetainPrompt(): string {
  if (process.env.NODE_ENV !== "production") {
    return readFileSync(PROMPT_FILE, "utf8").trim();
  }
  if (cached === undefined) {
    cached = readFileSync(PROMPT_FILE, "utf8").trim();
  }
  return cached;
}
