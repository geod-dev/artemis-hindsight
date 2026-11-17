import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useGlobalSearchParams, usePathname, useRouter, type Href } from "expo-router";
import { setReturnTo } from "@/lib/return-to";
import { Plus } from "lucide-react-native";
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
  const params = useGlobalSearchParams<{ session?: string }>();
  const { data, isPending, isError, refetch } = useConversations();
  const remove = useDeleteConversation();

  const go = (href: Href) => {
    // The settings open over the current page: back from them returns here (see lib/return-to.ts).
    if (href === "/settings" && !pathname.startsWith("/settings")) {
      setReturnTo((params.session ? `${pathname}?session=${params.session}` : pathname) as Href);
    }
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

      {/* The bottom bar: the account (avatar only, opens the settings) on the left, a new chat on the right. A new session
          each time: /new stays mounted after its first reply, so the same route alone would show that chat. */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => go("/settings")}
          accessibilityRole="link"
          accessibilityLabel="Account and settings"
          hitSlop={8}
          style={[styles.avatar, { backgroundColor: user ? avatarHex(user.avatarColor, user.username) : colors.muted }]}
        >
          <Text style={styles.avatarText}>{user ? initialsOf(user.displayName ?? user.username) : "?"}</Text>
        </Pressable>
        <Pressable
          onPress={() => go(`/new?session=${Date.now()}`)}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          style={[styles.newButton, { backgroundColor: colors.accent }]}
        >
          <Plus size={20} color={colors.accentText} />
          <Text style={[styles.newButtonText, { color: colors.accentText }]}>New Chat</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12 },
  newButton: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20 },
  newButtonText: { fontSize: 16, fontWeight: "600" },
  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { padding: 12, fontSize: 14 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, paddingHorizontal: 4, marginTop: "auto" },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
