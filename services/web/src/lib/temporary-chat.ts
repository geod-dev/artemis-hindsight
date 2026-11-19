/**
 * Temporary chats: kept out of the conversation lists and out of memory, and deleted once no page has shown them for
 * an hour. Shared by the server and the browser. Same values as apps/mobile/src/lib/temporary-chat.ts.
 *
 *   personalized    the agent still knows the user: their memory, workspace, skills and profile.
 *   unpersonalized  the agent knows nothing about the user: no memory, no profile, no workspace; only its session folder.
 */
export const TEMPORARY_MODES = ["personalized", "unpersonalized"] as const;
export type TemporaryMode = (typeof TEMPORARY_MODES)[number];

/** What the top bar shows instead of a name: a temporary chat is never named. */
export const TEMPORARY_CHAT_TITLE = "Temporary chat";

export const TEMPORARY_MODE_LABELS: Record<TemporaryMode, string> = {
  personalized: "Personalized",
  unpersonalized: "Not personalized",
};

/** How often an open page tells the server it still shows a temporary chat. Well inside the hour the server waits. */
export const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
