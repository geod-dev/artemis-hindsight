import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { apiFetch } from "@/lib/api";

// Mirrors services/web/src/server/conversations/conversation-json.ts (ConversationJson).
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  /** A reply finished here while nobody was watching: the drawer shows a dot until it is opened. */
  unread: boolean;
  /** The project the conversation belongs to, or null outside any project. Its color is the bar before the title. */
  project: { id: string; name: string; color: string } | null;
}

export interface ConversationPayload {
  /** The project the conversation belongs to, shown as a badge after its title. Null outside any project. */
  conversation: { id: string; title: string; project: { id: string; name: string; color: string } | null };
  messages: UIMessage[];
  /** The turn running in this conversation right now, if any. */
  activeStreamId: string | null;
}

export const conversationsKey = ["conversations"] as const;
export const messagesKey = (id: string) => ["conversation-messages", id] as const;

/** The signed-in user's conversations, most recent first (the web app's sidebar list). */
export function useConversations() {
  return useQuery({
    queryKey: conversationsKey,
    queryFn: () => apiFetch<{ conversations: ConversationSummary[] }>("/api/conversations"),
    select: (data) => data.conversations,
    // A reply can finish while the user is in another conversation: the unread dots follow it.
    refetchInterval: 15_000,
  });
}

/** One conversation's stored messages as UI messages. Not cached across visits: the chat refreshes it after a turn. */
export function useConversationMessages(id: string, enabled: boolean) {
  return useQuery({
    queryKey: messagesKey(id),
    queryFn: () => apiFetch<ConversationPayload>(`/api/conversations/${id}/messages`),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

// The archived list sits under the conversations key, so invalidating that key refreshes it too.
export const archivedConversationsKey = [...conversationsKey, "archived"] as const;

/** The archived conversations, most recent first (the danger zone's archived chats screen). */
export function useArchivedConversations() {
  return useQuery({
    queryKey: archivedConversationsKey,
    queryFn: () => apiFetch<{ conversations: ConversationSummary[] }>("/api/conversations?archived=true"),
    select: (data) => data.conversations,
  });
}

/** Archives (`archived: true`) or restores (`false`) one conversation. */
export function useSetConversationArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      apiFetch(`/api/conversations/${id}`, { method: "PATCH", json: { archived } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
}

/** Moves one conversation into a project, or takes it out of its project (`projectId` null). */
export function useSetConversationProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string | null }) =>
      apiFetch(`/api/conversations/${id}`, { method: "PATCH", json: { projectId } }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: conversationsKey }),
      // The projects' own lists (their recents and counts) change too. Same key as queries/projects.ts's projectsKey.
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
}

/** Archives every listed conversation. Answers with how many were archived. */
export function useArchiveAllConversations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ archived: number }>("/api/conversations/archive-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
}

/** Deletes every conversation, archived or not. The memory is kept. */
export function useDeleteAllChats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/conversations/delete-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
}

/** Deletes every conversation and the whole memory. The account stays. */
export function useDeleteAllData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/me/data", { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: conversationsKey });
      await queryClient.invalidateQueries({ queryKey: ["memory-graph"] });
    },
  });
}
