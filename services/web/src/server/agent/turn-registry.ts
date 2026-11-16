import {
  createInMemoryResumableStreamStore,
  createResumableStreamContext,
  type ResumableStreamContext,
} from "assistant-stream/resumable";

/**
 * A turn is owned by the server: it runs whether or not a browser is connected. The browser only
 * reads it, through the resumable stream, and can ask the server to stop it.
 *
 * The state lives on globalThis so Next's dev reloads of this module do not forget running turns.
 * The store is in memory, so turns end when the server process restarts; the messages saved so far stay.
 */
interface ActiveTurn {
  streamId: string;
  abort: AbortController;
}

interface TurnRegistry {
  resumable: ResumableStreamContext;
  activeByConversation: Map<string, ActiveTurn>;
  /** Which user started each stream, so a reload can only resume the user's own turns. */
  ownerByStream: Map<string, string>;
  /** How many HTTP responses are reading each stream right now (the page, another device, a resume). */
  viewersByStream: Map<string, number>;
}

const globalForTurns = globalThis as unknown as { artemisTurnRegistry?: TurnRegistry };

const registry: TurnRegistry = (globalForTurns.artemisTurnRegistry ??= {
  resumable: createResumableStreamContext({ store: createInMemoryResumableStreamStore() }),
  activeByConversation: new Map(),
  ownerByStream: new Map(),
  viewersByStream: new Map(),
});

export const resumable = registry.resumable;

export function startTurn(conversationId: string, streamId: string, ownerId: string): ActiveTurn {
  const turn: ActiveTurn = { streamId, abort: new AbortController() };
  registry.activeByConversation.set(conversationId, turn);
  (registry.ownerByStream ??= new Map()).set(streamId, ownerId);
  return turn;
}

/** The user who started a stream, or undefined when the stream is unknown. */
export function streamOwner(streamId: string): string | undefined {
  return registry.ownerByStream?.get(streamId);
}

/** The stream id of the turn running in a conversation, or null. A client that opens the conversation can join it. */
export function activeStreamOf(conversationId: string): string | null {
  return registry.activeByConversation.get(conversationId)?.streamId ?? null;
}

/**
 * One reply at a time per conversation. A message sent while a reply runs waits its turn, in order, instead of
 * starting a second stream on the same conversation. Returns the function that frees the slot.
 */
const queueByConversation = new Map<string, Promise<void>>();

export async function acquireTurn(conversationId: string): Promise<() => void> {
  const previous = queueByConversation.get(conversationId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  queueByConversation.set(conversationId, previous.then(() => mine));
  await previous;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
  };
}

export function endTurn(conversationId: string, streamId: string): void {
  if (registry.activeByConversation.get(conversationId)?.streamId === streamId) {
    registry.activeByConversation.delete(conversationId);
  }
}

/** Whether at least one HTTP response is reading this stream right now. */
export function hasViewers(streamId: string): boolean {
  return (registry.viewersByStream?.get(streamId) ?? 0) > 0;
}

/**
 * Wraps the response body of a stream and counts it as a viewer while the client reads it. A client that
 * disconnects (closes the page, switches conversation, loses the network) cancels the body and stops counting,
 * so the turn itself is never affected: it runs to its end in the store either way.
 */
export function watchViewers(streamId: string, body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const viewers = (registry.viewersByStream ??= new Map());
  const reader = body.getReader();
  viewers.set(streamId, (viewers.get(streamId) ?? 0) + 1);
  let counted = true;
  const leave = () => {
    if (!counted) return;
    counted = false;
    const left = (viewers.get(streamId) ?? 1) - 1;
    if (left > 0) viewers.set(streamId, left);
    else viewers.delete(streamId);
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          leave();
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        leave();
        controller.error(error);
      }
    },
    cancel(reason) {
      leave();
      return reader.cancel(reason);
    },
  });
}

/** Asks the running turn of a conversation to stop. False when no turn is running. */
export function stopTurn(conversationId: string): boolean {
  const turn = registry.activeByConversation.get(conversationId);
  if (!turn) return false;
  turn.abort.abort();
  return true;
}
