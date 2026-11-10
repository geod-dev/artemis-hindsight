import type { UIMessage } from "ai";
import { attachmentNotice, modelFileParts } from "./attachments";
import { renderUserPrompt, textOf, type MemoryLookup } from "./memory-context";

/**
 * The history as the model reads it. Each user message gets its attachment notice and its images and PDFs.
 * Only the latest user message also gets the memory block. The stored messages are not changed.
 */
export async function toModelHistory(
  conversationId: string,
  history: UIMessage[],
  lookup: MemoryLookup,
): Promise<UIMessage[]> {
  let latest = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === "user") {
      latest = i;
      break;
    }
  }

  const out: UIMessage[] = [];
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    if (!message) continue;
    if (message.role !== "user") {
      out.push(message);
      continue;
    }

    const notice = attachmentNotice(conversationId, message.parts);
    const text = textOf(message);
    const content =
      i === latest
        ? renderUserPrompt(text, lookup, notice)
        : [notice, text].filter(Boolean).join("\n");
    const files = await modelFileParts(conversationId, message.parts);

    out.push({ ...message, parts: [{ type: "text", text: content }, ...files] });
  }
  return out;
}
