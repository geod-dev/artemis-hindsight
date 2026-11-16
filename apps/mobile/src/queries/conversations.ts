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

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
}
