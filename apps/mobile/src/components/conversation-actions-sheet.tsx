import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useRouter, type Href } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  useDeleteConversation,
  useSetConversationArchived,
  useSetConversationProject,
  type ConversationSummary,
} from "@/queries/conversations";
import { useProjects } from "@/queries/projects";
import { usePreferences } from "@/preferences";
import { ActionSheet, ActionSheetOption } from "./action-sheet";

/**
 * The long-press menu of a conversation: move it into a project (or out of its project), archive (or restore, in the
 * archived list) and delete. Shared by the drawer's list and the archived chats screen, so both offer the same actions.
 * Pass `conversation` to open it, null to close it.
 */
export function ConversationActionsSheet({
  conversation,
  archived,
  onClose,
  onDeleted,
}: {
  conversation: ConversationSummary | null;
  /** True in the archived list: the archive action restores the conversation instead of archiving it. */
  archived: boolean;
  onClose: () => void;
  /** Called once the conversation is deleted (the drawer leaves the chat when it was the open one). */
  onDeleted?: (id: string) => void;
}) {
  const { colors } = usePreferences();
  const router = useRouter();
  const projects = useProjects();
  const setArchived = useSetConversationArchived();
  const setProject = useSetConversationProject();
  const remove = useDeleteConversation();
  // The sheet keeps the last conversation while it slides away, so its title does not vanish mid-animation.
  const [shown, setShown] = useState(conversation);
  // The menu, or the list of projects to move the conversation into.
  const [view, setView] = useState<"menu" | "projects">("menu");
  useEffect(() => {
    if (conversation) {
      setShown(conversation);
      setView("menu");
    }
  }, [conversation]);

  const failed = (what: string) => (error: Error) =>
    Alert.alert(what, error instanceof ApiError ? error.message : "Try again later.");

  const confirmDelete = (target: ConversationSummary) =>
    Alert.alert("Delete conversation", `"${target.title}" and its messages will be deleted. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          remove.mutate(target.id, {
            onSuccess: () => onDeleted?.(target.id),
            onError: failed("Delete failed"),
          }),
      },
    ]);

  const move = (target: ConversationSummary, projectId: string | null) => {
    onClose();
    setProject.mutate({ id: target.id, projectId }, { onError: failed("Move failed") });
  };

  return (
    <ActionSheet visible={conversation !== null} onClose={onClose}>
      {shown && view === "projects" ? (
        <>
          <Text numberOfLines={1} style={[styles.title, { color: colors.muted }]}>
            Move to project
          </Text>
          {(projects.data ?? []).map((project) => (
            <ActionSheetOption
              key={project.id}
              label={project.name}
              selected={shown.project?.id === project.id}
              onPress={() => move(shown, project.id)}
            />
          ))}
          {projects.data?.length === 0 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>No projects yet. Create one from the Projects list.</Text>
          ) : null}
          <ActionSheetOption
            label="New project"
            onPress={() => {
              // The form creates the project and moves this conversation into it.
              onClose();
              router.navigate(`/projects/form?moveConversation=${shown.id}` as Href);
            }}
          />
          <ActionSheetOption label="Back" onPress={() => setView("menu")} />
        </>
      ) : shown ? (
        <>
          <Text numberOfLines={1} style={[styles.title, { color: colors.muted }]}>
            {shown.title}
          </Text>
          <ActionSheetOption label="Move to project" onPress={() => setView("projects")} />
          {shown.project ? (
            <ActionSheetOption label="Remove from project" onPress={() => move(shown, null)} />
          ) : null}
          <ActionSheetOption
            label={archived ? "Restore" : "Archive"}
            onPress={() => {
              onClose();
              setArchived.mutate({ id: shown.id, archived: !archived }, { onError: failed(archived ? "Restore failed" : "Archive failed") });
            }}
          />
          <ActionSheetOption
            label="Delete"
            destructive
            onPress={() => {
              onClose();
              confirmDelete(shown);
            }}
          />
        </>
      ) : null}
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, paddingHorizontal: 4, marginBottom: 4 },
  hint: { fontSize: 13, paddingHorizontal: 4, paddingVertical: 4 },
});
