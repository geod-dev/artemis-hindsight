import { readFileSync } from "node:fs";
import path from "node:path";

// The system prompt lives in prompts/system-prompt.md so it can be edited without touching code.
// In development it is read on every call, so an edit applies to the next message. In production it is read once
// per server process: the file is baked into the image, so a change needs a rebuild.
const PROMPT_FILE = path.join(process.cwd(), "prompts", "system-prompt.md");

let cached: string | undefined;

export function loadSystemPrompt(): string {
  if (process.env.NODE_ENV !== "production") {
    return readFileSync(PROMPT_FILE, "utf8").trim();
  }
  if (cached === undefined) {
    cached = readFileSync(PROMPT_FILE, "utf8").trim();
  }
  return cached;
}
