import { activeStreamOf } from "../agent/turn-registry";
import { expiredTemporaryConversations } from "../repositories/conversation-repository";
import { deleteConversation } from "./conversation-service";

// Deleting the temporary chats nobody looks at anymore. Every page that shows a temporary chat keeps it alive (see
// /api/conversations/<id>/keepalive), and so does every turn. Once an hour, the chats that have not been kept alive
// for an hour are deleted with their sandbox folder: between one and two hours after the last page was closed.

const IDLE_MS = 60 * 60 * 1000;
const SWEEP_MS = 60 * 60 * 1000;

/** Starts the hourly sweep once per process (Next.js dev hot reloads must not start a second one), and runs it now. */
export function startTemporaryChatSweep(): void {
  const holder = globalThis as unknown as { __artemisTemporaryChatSweep?: boolean };
  if (holder.__artemisTemporaryChatSweep) return;
  holder.__artemisTemporaryChatSweep = true;

  void deleteExpiredTemporaryChats();
  const timer = setInterval(() => void deleteExpiredTemporaryChats(), SWEEP_MS);
  timer.unref?.();
}

/**
 * Deletes the temporary chats idle for an hour. A chat whose reply is still running is kept: the end of the turn keeps it
 * alive again. A failed delete (the sandbox did not answer) is logged and retried on the next sweep.
 */
export async function deleteExpiredTemporaryChats(now = new Date()): Promise<void> {
  try {
    const expired = await expiredTemporaryConversations(new Date(now.getTime() - IDLE_MS));
    for (const { id, userId } of expired) {
      if (activeStreamOf(id)) continue;
      try {
        await deleteConversation(userId, id);
      } catch (error) {
        console.warn("temporary chat deletion failed", { conversationId: id, reason: reasonOf(error) });
      }
    }
  } catch (error) {
    console.warn("temporary chat sweep failed", { reason: reasonOf(error) });
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
