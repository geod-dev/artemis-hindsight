import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { ApiError } from "@/lib/api";
import { useDeleteConversation, useSetConversationArchived, type ConversationSummary } from "@/queries/conversations";
import { usePreferences } from "@/preferences";
import { ActionSheet, ActionSheetOption } from "./action-sheet";

/**
 * The long-press menu of a conversation: archive (or restore, in the archived list) and delete. Shared by the drawer's
 * list and the archived chats screen, so both offer the same actions. Pass `conversation` to open it, null to close it.
 */
export function ConversationActionsSheet({
  conversation,
  archived,
  onClose,
  onDeleted,
}: {
  conversation: ConversationSummary | null;
  /** True in the archived list: the first action restores the conversation instead of archiving it. */
  archived: boolean;
  onClose: () => void;
  /** Called once the conversation is deleted (the drawer leaves the chat when it was the open one). */
  onDeleted?: (id: string) => void;
}) {
  const { colors } = usePreferences();
  const setArchived = useSetConversationArchived();
  const remove = useDeleteConversation();
  // The sheet keeps the last conversation while it slides away, so its title does not vanish mid-animation.
  const [shown, setShown] = useState(conversation);
  useEffect(() => {
    if (conversation) setShown(conversation);
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

  return (
    <ActionSheet visible={conversation !== null} onClose={onClose}>
      {shown ? (
        <>
          <Text numberOfLines={1} style={[styles.title, { color: colors.muted }]}>
            {shown.title}
          </Text>
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
});
