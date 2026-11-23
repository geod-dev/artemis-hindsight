import type { ProviderMetadata, UIMessage, UIMessageChunk, UIMessageStreamWriter } from "ai";

// Continuing a reply the user stopped, in the same message.
//
// The clients start a continuation through the regenerate path (assistant-ui offers no other way to run without a new user
// message), which drops the stopped reply on their side. So the turn's stream rebuilds it: it opens with the stopped
// reply's id, replays the parts the reply had, then carries the model's continuation. The client shows the reply whole
// again at once, and the stored message is the same row, completed. Text cut mid-sentence goes on in the same text part.

/** What the model reads after its stopped reply. Not stored, not shown. */
export const CONTINUE_INSTRUCTION =
  "<continue_reply>The user stopped your previous reply before it ended and now asks you to continue it. Continue from " +
  "exactly where it stopped, mid-sentence if needed: do not repeat what is already written, do not start over, do not " +
  "mention the interruption.</continue_reply>";

/** A reply part as stored: the fields of the part types that are replayed. */
type StoredPart = UIMessage["parts"][number] & {
  text?: string;
  state?: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  providerMetadata?: ProviderMetadata;
  callProviderMetadata?: ProviderMetadata;
};

/**
 * Writes the stopped reply's parts on the stream, as the chunks that build them. Tool calls that never got a result are
 * left out (the model does not read them either). When the reply ends with text, that text part is left open, and so is
 * its step, so the continuation can go on in it (see `continueInOpenText`).
 */
export interface Replayed {
  /** The id of the text part left open, or null when the reply does not end with text. */
  openTextId: string | null;
  /** True when the open text's step is left open too. */
  stepOpen: boolean;
}

export function replayReply(writer: UIMessageStreamWriter<UIMessage>, reply: UIMessage): Replayed {
  const parts = reply.parts as StoredPart[];
  const last = parts.at(-1);
  let openTextId: string | null = null;
  let stepOpen = false;
  parts.forEach((part, index) => {
    const id = `replay-${index}`;
    const providerMetadata = part.providerMetadata ? { providerMetadata: part.providerMetadata } : {};
    if (part.type === "step-start") {
      if (stepOpen) writer.write({ type: "finish-step" });
      writer.write({ type: "start-step" });
      stepOpen = true;
    } else if (part.type === "text") {
      writer.write({ type: "text-start", id, ...providerMetadata });
      if (part.text) writer.write({ type: "text-delta", id, delta: part.text });
      if (part === last) openTextId = id;
      else writer.write({ type: "text-end", id, ...providerMetadata });
    } else if (part.type === "reasoning") {
      writer.write({ type: "reasoning-start", id, ...providerMetadata });
      if (part.text) writer.write({ type: "reasoning-delta", id, delta: part.text });
      writer.write({ type: "reasoning-end", id, ...providerMetadata });
    } else if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const finished = part.state === "output-available" || part.state === "output-error";
      if (!finished || !part.toolCallId) return;
      const toolName = part.type === "dynamic-tool" ? (part.toolName ?? "") : part.type.slice("tool-".length);
      writer.write({
        type: "tool-input-available",
        toolCallId: part.toolCallId,
        toolName,
        input: part.input,
        ...(part.type === "dynamic-tool" ? { dynamic: true } : {}),
        ...(part.callProviderMetadata ? { providerMetadata: part.callProviderMetadata } : {}),
      });
      if (part.state === "output-available") {
        writer.write({ type: "tool-output-available", toolCallId: part.toolCallId, output: part.output });
      } else {
        writer.write({ type: "tool-output-error", toolCallId: part.toolCallId, errorText: part.errorText ?? "" });
      }
    } else if (
      part.type === "source-url" ||
      part.type === "source-document" ||
      part.type === "file" ||
      part.type.startsWith("data-")
    ) {
      // These parts are their own chunks, field for field.
      writer.write(part as unknown as UIMessageChunk);
    }
  });
  if (stepOpen && !openTextId) {
    writer.write({ type: "finish-step" });
    stepOpen = false;
  }
  return { openTextId, stepOpen };
}

/** Chunks that start content: before any of them, the continuation has not written text yet. */
const CONTENT_STARTS = new Set(["text-start", "reasoning-start", "tool-input-start", "tool-input-available", "file"]);

/**
 * Continues the model's first text in the replayed text part left open, when the continuation starts with text: a reply
 * cut mid-sentence then reads as one sentence. When it starts with something else (thinking, a tool), the open part is
 * closed first and the continuation follows it. The open part is always closed by the end of the stream.
 */
export function continueInOpenText({ openTextId, stepOpen }: Replayed): TransformStream<UIMessageChunk, UIMessageChunk> {
  let open = openTextId;
  let mapped: string | null = null;
  // The replay's last step is still open: the continuation's first step goes on in it.
  let skipStartStep = stepOpen;
  return new TransformStream({
    transform(chunk, controller) {
      if (skipStartStep && chunk.type === "start-step") {
        skipStartStep = false;
        return;
      }
      if (open && mapped === null && CONTENT_STARTS.has(chunk.type)) {
        if (chunk.type === "text-start") {
          mapped = chunk.id;
          return;
        }
        controller.enqueue({ type: "text-end", id: open });
        open = null;
      }
      if (open && mapped !== null && "id" in chunk && chunk.id === mapped) {
        if (chunk.type === "text-delta") {
          controller.enqueue({ ...chunk, id: open });
          return;
        }
        if (chunk.type === "text-end") {
          controller.enqueue({ ...chunk, id: open });
          open = null;
          return;
        }
      }
      controller.enqueue(chunk);
    },
    flush(controller) {
      if (open) controller.enqueue({ type: "text-end", id: open });
    },
  });
}
