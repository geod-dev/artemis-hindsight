import type { ReactNode } from "react";
import { ProjectBar } from "@/components/projects/project-icon";
import type { ProjectRef } from "@/lib/projects";

/**
 * The inside of a conversation's row, shared by the sidebar's Recents and the project's recents under the new chat: the
 * project's bar before the title, the title, the unread dot at the end, and an optional trailing `meta` such as a date.
 * The caller wraps it in its own link, so each list keeps its own selected state and hover.
 */
export function ConversationRowContent({
  title,
  project,
  unread,
  meta,
}: {
  title: string;
  project: ProjectRef | null;
  unread: boolean;
  meta?: ReactNode;
}) {
  return (
    <>
      {project && <ProjectBar color={project.color} />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {unread && <span role="status" aria-label="Unread reply" className="size-2 shrink-0 rounded-full bg-primary" />}
      {meta}
    </>
  );
}
