"use client";

import { useEffect, useState } from "react";
import { onNewChatProjectSelected, setNewChatProjectSelection } from "@/lib/new-chat-project";
import type { ProjectSummary } from "@/lib/projects";
import type { TemporaryMode } from "@/lib/temporary-chat";
import { ChatSession } from "./chat-session";

/**
 * The new-chat view. The conversation id is created here and stored by the server with the first message. The project
 * picker and the sidebar both choose the project; a project that no longer exists is dropped, so it is never sent.
 * The selection is also recorded for the sidebar, which highlights it. A temporary chat has no project: while the
 * temporary switch is on, the project is neither shown nor sent.
 */
export function NewChat({
  projects,
  initialProjectId,
}: {
  projects: ProjectSummary[];
  initialProjectId: string | null;
}) {
  const [conversationId] = useState(() => crypto.randomUUID());
  const [selected, setSelected] = useState(initialProjectId);
  const [temporary, setTemporary] = useState<TemporaryMode | null>(null);
  useEffect(() => onNewChatProjectSelected(setSelected), []);

  const projectId = !temporary && projects.some((project) => project.id === selected) ? selected : null;

  useEffect(() => {
    setNewChatProjectSelection(projectId);
    return () => setNewChatProjectSelection(null);
  }, [projectId]);

  return (
    <ChatSession
      conversationId={conversationId}
      isNewConversation
      projects={projects}
      projectId={projectId}
      onProjectChange={setSelected}
      temporary={temporary}
      onTemporaryChange={setTemporary}
    />
  );
}
