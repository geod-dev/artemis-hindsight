import type { UIMessage } from "ai";

/**
 * A conversation with all its branches: every message with the one it follows, and the last message of the branch the
 * user was on. The shape of assistant-ui's message repository, so the chat runtime takes it as it is.
 * The mobile app has the same type in apps/mobile/src/chat/message-tree.ts.
 */
export interface MessageTree {
  headId: string | null;
  messages: { parentId: string | null; message: UIMessage }[];
}

/** When a message last ended the branch the user was on (metadata.visitedAt), in milliseconds. 0 when never. */
export function visitedAtOf(message: UIMessage): number {
  const visitedAt = (message.metadata as { visitedAt?: string } | undefined)?.visitedAt;
  return visitedAt ? Date.parse(visitedAt) || 0 : 0;
}

/**
 * The messages to switch to, in order, so that every fork of the tree points at the branch visited last there: each
 * visited message from the oldest visit to the newest, then the head. The runtime keeps, at every fork, the branch it
 * last switched through, so replaying the visits rebuilds what the user last saw at each fork.
 */
export function branchVisitOrder(tree: MessageTree): string[] {
  const visited = tree.messages
    .filter(({ message }) => visitedAtOf(message) > 0 && message.id !== tree.headId)
    .sort((a, b) => visitedAtOf(a.message) - visitedAtOf(b.message))
    .map(({ message }) => message.id);
  return tree.headId ? [...visited, tree.headId] : visited;
}

/** True when some message of the tree has a sibling: only then is there a branch to restore. */
export function hasBranches(tree: MessageTree): boolean {
  const parents = new Set<string>();
  for (const { parentId } of tree.messages) {
    const key = parentId ?? "";
    if (parents.has(key)) return true;
    parents.add(key);
  }
  return false;
}
