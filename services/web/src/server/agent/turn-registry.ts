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
}

const globalForTurns = globalThis as unknown as { artemisTurnRegistry?: TurnRegistry };

const registry: TurnRegistry = (globalForTurns.artemisTurnRegistry ??= {
  resumable: createResumableStreamContext({ store: createInMemoryResumableStreamStore() }),
  activeByConversation: new Map(),
  ownerByStream: new Map(),
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

export function endTurn(conversationId: string, streamId: string): void {
  if (registry.activeByConversation.get(conversationId)?.streamId === streamId) {
    registry.activeByConversation.delete(conversationId);
  }
}

/** Asks the running turn of a conversation to stop. False when no turn is running. */
export function stopTurn(conversationId: string): boolean {
  const turn = registry.activeByConversation.get(conversationId);
  if (!turn) return false;
  turn.abort.abort();
  return true;
}
