import { useLocalSearchParams, useNavigation } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ChatScreen } from "@/chat/chat-screen";
import { ProjectPicker } from "@/chat/project-picker";
import { setNewChatConversation, setNewChatProjectSelection } from "@/chat/new-chat-selection";
import { TemporaryChatButton, TemporaryChatNotice, TemporaryChatTitle } from "@/chat/temporary-chat";
import { ConversationTitleBar } from "@/components/conversation-title-bar";
import { TEMPORARY_CHAT_TITLE, type TemporaryMode } from "@/lib/temporary-chat";
import { useProjects } from "@/queries/projects";

const DEFAULT_TITLE = "New conversation";

/**
 * A new conversation. The screen stays on this route for the whole chat: replacing the route with /c/<id> after the first
 * reply would mount a new screen that loads the conversation again (a spinner, then the chat remounts), so the header takes
 * the name when it arrives instead. The `session` parameter changes each time "New conversation" is pressed, which gives a
 * fresh chat even when this route is already open. The `project` parameter opens the chat with that project selected (the
 * drawer's Projects); a change of project is a fresh chat too.
 */
export default function NewChatScreen() {
  const { session, project } = useLocalSearchParams<{ session?: string; project?: string }>();
  return <NewChat key={`${session ?? "initial"}:${project ?? ""}`} initialProjectId={project ?? null} />;
}

/**
 * The temporary switch sits on the right of the top bar until the first message. A temporary chat has no project: while
 * the switch is on, the notice replaces the project picker, and no project is sent.
 */
function NewChat({ initialProjectId }: { initialProjectId: string | null }) {
  const [conversationId] = useState(() => randomUUID());
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [pickedId, setPickedId] = useState<string | null>(initialProjectId);
  const [temporary, setTemporary] = useState<TemporaryMode | null>(null);
  const [started, setStarted] = useState(false);
  const onStarted = useCallback(() => setStarted(true), []);
  const navigation = useNavigation();
  const projects = useProjects();
  const list = projects.data ?? [];
  // Only a project that still exists is used, as on the web: a project deleted meanwhile is never sent.
  const selected = temporary ? null : (list.find((project) => project.id === pickedId) ?? null);

  // The drawer highlights this chat's conversation once it exists in the list: the route stays /new, so it is told here.
  useEffect(() => {
    setNewChatConversation(conversationId);
    return () => setNewChatConversation(null);
  }, [conversationId]);

  // The drawer highlights the selected project: it reads the selection from here, as the web's sidebar does.
  useEffect(() => {
    setNewChatProjectSelection(selected?.id ?? null);
    return () => setNewChatProjectSelection(null);
  }, [selected?.id]);

  // The badge of the selected project shows once the conversation has its name (the placeholder title has none yet).
  const badgeProject = title !== DEFAULT_TITLE ? selected : null;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: temporary ? TEMPORARY_CHAT_TITLE : title,
      headerTitle: () =>
        temporary ? <TemporaryChatTitle mode={temporary} /> : <ConversationTitleBar title={title} project={badgeProject} />,
      headerRight: started ? undefined : () => <TemporaryChatButton value={temporary} onChange={setTemporary} />,
    });
  }, [navigation, title, badgeProject, temporary, started]);

  return (
    <ChatScreen
      conversationId={conversationId}
      initialMessages={[]}
      isNewConversation
      onTitle={setTitle}
      projectId={selected?.id ?? null}
      projectColor={selected?.color ?? null}
      temporary={temporary}
      onStarted={onStarted}
      projectPicker={
        temporary ? (
          <TemporaryChatNotice mode={temporary} />
        ) : (
          <ProjectPicker
            projects={list}
            selected={selected}
            onSelect={(projectId) => setPickedId(projectId)}
            onRemove={() => setPickedId(null)}
          />
        )
      }
    />
  );
}
