"use client";

import { useConversationTitles } from "@/components/conversation-titles";
import { ProjectBadge } from "@/components/projects/project-badge";
import { useTypedText } from "@/hooks/use-typed-text";
import type { ProjectRef } from "@/lib/projects";

/**
 * The conversation's name in the top bar, with its project's badge after it. A name that arrives while the chat is
 * open is typed out. The badge waits for the name: a new chat has none until its first reply is named.
 */
export function ConversationHeading({
  conversationId,
  initialTitle,
  project = null,
}: {
  conversationId: string;
  initialTitle: string;
  project?: ProjectRef | null;
}) {
  const { renamed } = useConversationTitles();
  const { text, typing } = useTypedText(renamed[conversationId] ?? initialTitle);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="block min-w-0 truncate">
        {text}
        {typing && (
          <span aria-hidden className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-current align-middle" />
        )}
      </span>
      {project && text && <ProjectBadge project={project} />}
    </span>
  );
}
