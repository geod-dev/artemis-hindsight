import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 4 }}>
        Actions on all your chats and memory at once. Some of them cannot be undone.
      </Text>

      <Pressable
        onPress={() => router.navigate("/settings/danger/archived")}
        accessibilityRole="link"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Archived chats</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Restore them to the list, or delete them for good.</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={() =>
          confirm("Archive all chats?", "Every chat leaves the list. You can restore them from archived chats.", "Archive all", () =>
            archiveAll.mutate(undefined, {
              onSuccess: ({ archived }) => setNotice(`${archived} ${archived === 1 ? "chat" : "chats"} archived.`),
              onError: failed("Archive failed"),
            }),
          )
        }
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Archive all chats</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Moves every chat out of the list. Nothing is deleted.</Text>
        </View>
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={() =>
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
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.danger, fontSize: 16 }}>Delete all chats</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Deletes every chat with its messages and files. Memory is kept.</Text>
        </View>
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={() =>
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
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.danger, fontSize: 16 }}>Delete all data</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Deletes every chat and everything Artemis remembers about you.</Text>
        </View>
      </Pressable>

      {notice ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16 },
});
