import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { absoluteUrl, apiFetch, apiForm, authHeaders } from "@/lib/api";
import { conversationsKey, projectConversationsKey, type ConversationSummary } from "./conversations";

// Mirrors services/web/src/server/projects/project-service.ts (ProjectJson) and the web's lib/projects.ts. The routes are
// /api/projects (list, create), /api/projects/<id> (update, delete), /api/projects/<id>/icon and
// /api/projects/<id>/conversations?limit=&offset=.

export interface ProjectSummary {
  id: string;
  name: string;
  /** A palette color id, the same palette as the avatar colors (see lib/avatar.ts). */
  color: string;
  description: string | null;
  hasIcon: boolean;
  updatedAt: string;
}

/** A picked image, as expo-document-picker returns it: its uri, name and type. */
export interface PickedIcon {
  uri: string;
  name: string;
  type: string;
}

export interface ProjectDraft {
  name: string;
  color: string;
  /** Empty means no instructions. */
  description: string;
  /** A new icon. Left out, the project keeps its icon (or has none, when it had none). */
  icon?: PickedIcon;
  /** Edit only: drop the project's current icon. */
  removeIcon?: boolean;
}

export const projectsKey = ["projects"] as const;
/** Each project's conversation lists are under projectConversationsKey (queries/conversations.ts). */
export const projectConversationsOf = (projectId: string) => [...projectConversationsKey, projectId] as const;

/** The signed-in user's projects, by name (the drawer's Projects section). */
export function useProjects() {
  return useQuery({
    queryKey: projectsKey,
    queryFn: () => apiFetch<{ projects: ProjectSummary[] }>("/api/projects"),
    select: (data) => data.projects,
  });
}

/** The image source of a project's icon. Its update time is in the url, so a changed icon is fetched again. */
export function projectIconSource(project: Pick<ProjectSummary, "id" | "updatedAt">) {
  return {
    uri: absoluteUrl(`/api/projects/${project.id}/icon?v=${encodeURIComponent(project.updatedAt)}`),
    headers: authHeaders(),
  };
}

/** The most recent conversations of a project: the new chat's recents, four at a time. */
export function useProjectRecents(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...projectConversationsOf(projectId), "recent"],
    queryFn: () =>
      apiFetch<{ conversations: ConversationSummary[]; total: number }>(
        `/api/projects/${projectId}/conversations?limit=4&offset=0`,
      ),
    enabled,
    select: (data) => ({ conversations: data.conversations, total: data.total }),
  });
}

const PAGE_SIZE = 30;

/** All of a project's conversations, most recent first, loaded a page at a time as the list is scrolled. */
export function useProjectConversationPages(projectId: string) {
  return useInfiniteQuery({
    queryKey: [...projectConversationsOf(projectId), "all"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiFetch<{ conversations: ConversationSummary[]; total: number }>(
        `/api/projects/${projectId}/conversations?limit=${PAGE_SIZE}&offset=${pageParam}`,
      ),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((count, page) => count + page.conversations.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
}

/** Refreshes the projects and every conversation list: a project's change moves conversations between lists. */
function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: projectsKey }),
      queryClient.invalidateQueries({ queryKey: projectConversationsKey }),
      queryClient.invalidateQueries({ queryKey: conversationsKey }),
    ]);
}

/** The form fields of a draft. An icon is sent only when one was picked; `removeIcon` only on an edit. */
function draftFields(draft: ProjectDraft) {
  return {
    name: draft.name.trim(),
    color: draft.color,
    description: draft.description.trim(),
    removeIcon: draft.removeIcon ? "true" : undefined,
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (draft: ProjectDraft) =>
      apiForm<ProjectSummary>(
        "POST",
        "/api/projects",
        { name: draft.name.trim(), color: draft.color, description: draft.description.trim() },
        draft.icon ? { field: "icon", file: draft.icon } : undefined,
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateProject(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (draft: ProjectDraft) =>
      apiForm<ProjectSummary>(
        "PATCH",
        `/api/projects/${projectId}`,
        draftFields(draft),
        draft.icon ? { field: "icon", file: draft.icon } : undefined,
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (projectId: string) => apiFetch(`/api/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/** Saves the order of the user's projects: every project id, in the order they show. The web's sidebar saves the same. */
export function useSaveProjectOrder() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (ids: string[]) => apiFetch("/api/projects/order", { method: "PUT", json: { ids } }),
    onSuccess: invalidate,
  });
}
