// The project and conversation shapes the apps receive from /api/projects and /api/conversations. Mirrors
// services/web/src/server/projects/project-service.ts and server/conversations/conversation-json.ts; the mobile app
// keeps its own copy (apps/mobile/src/queries) with the same fields.

export interface ProjectSummary {
  id: string;
  name: string;
  color: string;
  description: string | null;
  hasIcon: boolean;
  updatedAt: string;
}

/** The project a conversation belongs to, as lists and the conversation's top bar show it. */
export interface ProjectRef {
  id: string;
  name: string;
  color: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  unread: boolean;
  project: ProjectRef | null;
}

/** The project's icon. Its update time is in the URL, so a new icon is fetched rather than taken from the cache. */
export function projectIconUrl(project: Pick<ProjectSummary, "id" | "updatedAt">): string {
  return `/api/projects/${project.id}/icon?v=${encodeURIComponent(project.updatedAt)}`;
}

/** The new chat page with a project selected. Clicking a project in the sidebar goes here. */
export function newChatInProjectHref(projectId: string): string {
  return `/?project=${encodeURIComponent(projectId)}`;
}
