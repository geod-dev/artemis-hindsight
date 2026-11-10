import type { UIMessage } from "ai";
import type { RecalledFact } from "../clients/hindsight-client";

/** What the memory lookup produced for one user turn. */
export type MemoryLookup =
  | { status: "ok"; query: string; budget: string; facts: RecalledFact[] }
  | { status: "unavailable"; query: string; budget: string; reason: string };

/**
 * Renders the recalled memory, the attachment notice and the user's text as one XML-tagged user message, e.g.
 *
 *   <memory source="hindsight" budget="low">
 *     <fact type="world">Alice works at Google.</fact>
 *   </memory>
 *   <attachments>...</attachments>
 *   <user_message>What does Alice do?</user_message>
 *
 * The model is told in the system prompt that <memory> is background context, not a request.
 */
export function renderUserPrompt(userText: string, lookup: MemoryLookup, notice = ""): string {
  const memory =
    lookup.status === "ok"
      ? [
          `<memory source="hindsight" budget="${escapeAttr(lookup.budget)}">`,
          ...lookup.facts.map((fact) => {
            const typeAttr = fact.type ? ` type="${escapeAttr(fact.type)}"` : "";
            return `  <fact${typeAttr}>${escapeText(fact.text)}</fact>`;
          }),
          "</memory>",
        ].join("\n")
      : `<memory source="hindsight" status="unavailable" />`;

  return [memory, notice, `<user_message>\n${userText}\n</user_message>`].filter(Boolean).join("\n");
}

export function textOf(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("")
    .trim();
}

export function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}
