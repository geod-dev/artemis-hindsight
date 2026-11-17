import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Button, Column, ListItem, ScrollView, Text } from "@expo/ui";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { ApiError } from "@/lib/api";
import {
  useArchiveAllConversations,
  useDeleteAllChats,
  useDeleteAllData,
} from "@/queries/conversations";
import { usePreferences } from "@/preferences";

// The danger zone: bulk actions on every chat and the memory. The same routes serve the web app (settings/danger).

export default function DangerZone() {
  const router = useRouter();
  const { colors } = usePreferences();
  const [notice, setNotice] = useState<string | null>(null);
  const archiveAll = useArchiveAllConversations();
  const deleteAllChats = useDeleteAllChats();
  const deleteAllData = useDeleteAllData();
  const busy = archiveAll.isPending || deleteAllChats.isPending || deleteAllData.isPending;

  const failed = (what: string) => (error: Error) =>
    Alert.alert(what, error instanceof ApiError ? error.message : "Try again later.");

  const confirm = (title: string, message: string, label: string, run: () => void) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: label, style: "destructive", onPress: run },
    ]);

  return (
    <M3Host style={{ flex: 1 }}>
      <ScrollView>
        <Column>
          <Text textStyle={{ color: colors.muted }}>
            Actions on all your chats and memory at once. Some of them cannot be undone.
          </Text>

          <ListItem onPress={() => router.navigate("/settings/danger/archived")}>
            <Text>Archived chats</Text>
            <ListItem.Supporting>
              <Text textStyle={{ color: colors.muted }}>Restore them to the list, or delete them for good.</Text>
            </ListItem.Supporting>
            <ListItem.Trailing>
              <Glyph name="chevronRight" />
            </ListItem.Trailing>
          </ListItem>

          <ListItem
            onPress={() =>
              !busy &&
              confirm("Archive all chats?", "Every chat leaves the list. You can restore them from archived chats.", "Archive all", () =>
                archiveAll.mutate(undefined, {
                  onSuccess: ({ archived }) => setNotice(`${archived} ${archived === 1 ? "chat" : "chats"} archived.`),
                  onError: failed("Archive failed"),
                }),
              )
            }
          >
            <Text>Archive all chats</Text>
            <ListItem.Supporting>
              <Text textStyle={{ color: colors.muted }}>Moves every chat out of the list. Nothing is deleted.</Text>
            </ListItem.Supporting>
          </ListItem>

          <ListItem
            onPress={() =>
              !busy &&
              confirm(
                "Delete all chats?",
                "Every chat and its messages will be removed, archived or not. Your memory stays. This cannot be undone.",
                "Delete all chats",
                () =>
                  deleteAllChats.mutate(undefined, {
                    onSuccess: () => setNotice("All chats deleted."),
                    onError: failed("Delete failed"),
                  }),
              )
            }
          >
            <Text textStyle={{ color: colors.danger }}>Delete all chats</Text>
            <ListItem.Supporting>
              <Text textStyle={{ color: colors.muted }}>Deletes every chat with its messages and files. Memory is kept.</Text>
            </ListItem.Supporting>
          </ListItem>

          <ListItem
            onPress={() =>
              !busy &&
              confirm(
                "Delete all your data?",
                "Every chat and the whole memory will be erased. This cannot be undone.",
                "Delete all data",
                () =>
                  deleteAllData.mutate(undefined, {
                    onSuccess: () => setNotice("All your data was deleted."),
                    onError: failed("Delete failed"),
                  }),
              )
            }
          >
            <Text textStyle={{ color: colors.danger }}>Delete all data</Text>
            <ListItem.Supporting>
              <Text textStyle={{ color: colors.muted }}>Deletes every chat and everything Artemis remembers about you.</Text>
            </ListItem.Supporting>
          </ListItem>

          {notice ? <Text textStyle={{ color: colors.muted }}>{notice}</Text> : null}
        </Column>
      </ScrollView>
    </M3Host>
  );
}
