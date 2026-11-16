import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { useAuth } from "@/auth";
import { useConversations, useDeleteConversation, type ConversationSummary } from "@/queries/conversations";
import { usePreferences } from "@/preferences";
import { avatarHex, initialsOf } from "@/lib/avatar";

/** The web app's sidebar: new conversation, the list of conversations, settings and sign-out. */
export function ConversationsDrawer(props: DrawerContentComponentProps) {
  const { colors } = usePreferences();
  const { state } = useAuth();
  // The real status bar height on this phone, so the title sits right below it.
  const insets = useSafeAreaInsets();
  const user = state.status === "signedIn" ? state.user : null;
  const router = useRouter();
  const pathname = usePathname();
  const { data, isPending, isError, refetch } = useConversations();
  const remove = useDeleteConversation();

  const go = (href: Href) => {
    router.navigate(href);
    props.navigation.closeDrawer();
  };

  const confirmDelete = (conversation: ConversationSummary) => {
    Alert.alert("Delete conversation", `"${conversation.title}" will be deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          remove.mutate(conversation.id, {
            onSuccess: () => {
              if (pathname === `/c/${conversation.id}`) router.navigate("/new");
            },
          });
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => go("/new")} style={[styles.newButton, { backgroundColor: colors.accent }]}>
        <Text style={[styles.newButtonText, { color: colors.accentText }]}>+ New conversation</Text>
      </Pressable>

      {isPending ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
      ) : isError ? (
        <Pressable onPress={() => void refetch()} style={styles.item}>
          <Text style={{ color: colors.danger }}>Could not load conversations. Try again</Text>
        </Pressable>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No conversations yet.</Text>}
          renderItem={({ item }) => {
            const active = pathname === `/c/${item.id}`;
            const showUnread = item.unread && !active;
            return (
              <Pressable
                onPress={() => go(`/c/${item.id}`)}
                onLongPress={() => confirmDelete(item)}
                accessibilityRole="link"
                accessibilityLabel={showUnread ? `${item.title}, unread reply` : item.title}
                style={[styles.item, styles.row, active && { backgroundColor: colors.surfaceStrong }]}
              >
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, flexShrink: 1 }}>
                  {item.title}
                </Text>
                {showUnread ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
              </Pressable>
            );
          }}
        />
      )}

      {/* The account button: like the web sidebar footer, it opens the settings. */}
      <Pressable
        onPress={() => go("/settings")}
        accessibilityRole="link"
        accessibilityLabel="Account and settings"
        style={[styles.footer, { borderTopColor: colors.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: user ? avatarHex(user.avatarColor, user.username) : colors.muted }]}>
          <Text style={styles.avatarText}>{user ? initialsOf(user.displayName ?? user.username) : "?"}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "500", flexShrink: 1 }}>
          {user ? (user.displayName ?? user.username) : ""}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12 },
  newButton: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 12 },
  newButtonText: { fontSize: 15, fontWeight: "600" },
  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { padding: 12, fontSize: 14 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 4, marginTop: "auto" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
