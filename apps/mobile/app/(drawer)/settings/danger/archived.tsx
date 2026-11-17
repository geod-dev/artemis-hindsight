import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ConversationActionsSheet } from "@/components/conversation-actions-sheet";
import { useArchivedConversations, type ConversationSummary } from "@/queries/conversations";
import { usePreferences } from "@/preferences";

/** The archived chats: open one to read it, long-press it to restore it or delete it. */
export default function ArchivedChats() {
  const { colors } = usePreferences();
  const router = useRouter();
  const archived = useArchivedConversations();
  const [menuFor, setMenuFor] = useState<ConversationSummary | null>(null);

  if (archived.isPending) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.accent} />;
  if (archived.isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>Archived chats are unavailable right now.</Text>
        <Pressable onPress={() => void archived.refetch()}>
          <Text style={{ color: colors.accent, marginTop: 8 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={archived.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>No archived chats.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.navigate(`/c/${item.id}`)}
            onLongPress={() => setMenuFor(item)}
            delayLongPress={350}
            accessibilityRole="link"
            accessibilityHint="Long press for options"
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15 }}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />
      <ConversationActionsSheet conversation={menuFor} archived onClose={() => setMenuFor(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16 },
});
