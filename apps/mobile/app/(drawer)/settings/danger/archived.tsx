import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { Button, RNHostView, Text } from "@expo/ui";
import { ConversationActionsSheet } from "@/components/conversation-actions-sheet";
import { M3Host } from "@/components/m3";
import { useArchivedConversations, type ConversationSummary } from "@/queries/conversations";
import { usePreferences } from "@/preferences";

/** The archived chats: open one to read it, long-press it to restore it or delete it. */
export default function ArchivedChats() {
  const { colors } = usePreferences();
  const router = useRouter();
  const archived = useArchivedConversations();
  const [menuFor, setMenuFor] = useState<ConversationSummary | null>(null);

  if (archived.isPending) {
    return (
      <RNHostView matchContents>
        <ActivityIndicator color={colors.accent} />
      </RNHostView>
    );
  }
  if (archived.isError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <M3Host matchContents={{ vertical: true }}>
          <Text textStyle={{ color: colors.muted }}>Archived chats are unavailable right now.</Text>
          <Button variant="text" label="Try again" onPress={() => void archived.refetch()} />
        </M3Host>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={archived.data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <M3Host matchContents>
            <Text textStyle={{ color: colors.muted }}>No archived chats.</Text>
          </M3Host>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.navigate(`/c/${item.id}`)}
            onLongPress={() => setMenuFor(item)}
            delayLongPress={350}
            accessibilityRole="link"
            accessibilityHint="Long press for options"
          >
            <M3Host matchContents={{ vertical: true }}>
              <Text>{item.title}</Text>
            </M3Host>
          </Pressable>
        )}
      />
      <ConversationActionsSheet conversation={menuFor} archived onClose={() => setMenuFor(null)} />
    </View>
  );
}
