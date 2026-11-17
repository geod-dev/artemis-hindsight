import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { apiFetch } from "@/lib/api";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  /** A reply finished here while nobody was watching: the drawer shows a dot until it is opened. */
  unread: boolean;
}

export interface ConversationPayload {
  conversation: { id: string; title: string };
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
