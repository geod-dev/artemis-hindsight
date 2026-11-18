import type { ReactNode } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { ProjectBar } from "@/components/projects/project-icon";
import type { ProjectRef } from "@/lib/projects";

/**
 * The inside of a conversation's row, shared by the sidebar's Recents and the project's recents under the new chat: the
 * project's bar before the title, the title, then at the end a spinner while a reply runs or the unread dot once it
 * has finished unread, and an optional trailing `meta` such as a date. The caller wraps it in its own link, so each
 * list keeps its own selected state and hover.
 */
export function ConversationRowContent({
  title,
  project,
  unread,
  running = false,
  meta,
}: {
  title: string;
  project: ProjectRef | null;
  unread: boolean;
  running?: boolean;
  meta?: ReactNode;
}) {
  return (
    <>
      {project && <ProjectBar color={project.color} />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {running ? (
        <LoaderCircleIcon role="status" aria-label="Reply running" className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        unread && <span role="status" aria-label="Unread reply" className="size-2 shrink-0 rounded-full bg-primary" />
      )}
      {meta}
    </>
  );
}
