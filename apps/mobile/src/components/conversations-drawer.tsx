import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useGlobalSearchParams, usePathname, useRouter, type Href } from "expo-router";
import { setReturnTo } from "@/lib/return-to";
import { ArrowDownUp, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { useState } from "react";
import { useAuth } from "@/auth";
import { ActionSheet, ActionSheetOption } from "@/components/action-sheet";
import { ConversationActionsSheet } from "@/components/conversation-actions-sheet";
import { ProjectActionsSheet } from "@/components/project-actions-sheet";
import { ProjectBar, ProjectIcon } from "@/components/project-icon";
import { useConversations, type ConversationSummary } from "@/queries/conversations";
import { useProjects, type ProjectSummary } from "@/queries/projects";
import { usePreferences } from "@/preferences";
import { avatarHex, initialsOf } from "@/lib/avatar";

/**
 * The web app's sidebar: the Projects (each opens a new chat with that project selected), the Recents conversations,
 * then the account and the new chat button. Long press on a project or a conversation opens its menu.
 */
export function ConversationsDrawer(props: DrawerContentComponentProps) {
  const { colors, preferences, setShowProjectConversations } = usePreferences();
  const { state } = useAuth();
  // The real status bar height on this phone, so the title sits right below it.
  const insets = useSafeAreaInsets();
  const user = state.status === "signedIn" ? state.user : null;
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ session?: string; project?: string }>();
  const conversations = useConversations();
  const projects = useProjects();
  // The menus: the conversation or the project whose long-press menu is open.
  const [menuFor, setMenuFor] = useState<ConversationSummary | null>(null);
  const [projectMenuFor, setProjectMenuFor] = useState<ProjectSummary | null>(null);
  // The sort menu of Recents: whether the conversations of projects are listed too.
  const [sortOpen, setSortOpen] = useState(false);
  const allConversations = conversations.data ?? [];
  const recents = preferences.showProjectConversations ? allConversations : allConversations.filter((item) => !item.project);
  // A project shows an unread dot while one of its conversations has an unread reply that is not open now.
  const unreadProjectIds = new Set(
    allConversations.flatMap((item) =>
      item.unread && item.project && pathname !== `/c/${item.id}` ? [item.project.id] : [],
    ),
  );

  const go = (href: Href) => {
    // The settings open over the current page: back from them returns here (see lib/return-to.ts).
    if (href === "/settings" && !pathname.startsWith("/settings")) {
      setReturnTo((params.session ? `${pathname}?session=${params.session}` : pathname) as Href);
    }
    router.navigate(href);
    props.navigation.closeDrawer();
  };

  // A new chat with the project selected. A new session each time, so a chat already open is not reused.
  const openProject = (projectId: string) => go(`/new?project=${projectId}&session=${Date.now()}`);
  const selectedProject = pathname === "/new" ? params.project : undefined;

  const projectsSection = (
    <View>
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Projects</Text>
        <Pressable
          onPress={() => go("/projects/form" as Href)}
          accessibilityRole="button"
          accessibilityLabel="New project"
          hitSlop={10}
          style={styles.sectionAction}
        >
          <Plus size={18} color={colors.muted} />
        </Pressable>
      </View>
      {projects.data?.length === 0 ? <Text style={[styles.hint, { color: colors.muted }]}>No projects yet.</Text> : null}
      {projects.data?.map((project) => {
        const active = selectedProject === project.id;
        return (
          <Pressable
            key={project.id}
            onPress={() => openProject(project.id)}
            onLongPress={() => setProjectMenuFor(project)}
            accessibilityRole="link"
            accessibilityLabel={unreadProjectIds.has(project.id) ? `${project.name}, unread reply` : project.name}
            style={[styles.item, styles.row, active && { backgroundColor: colors.surfaceStrong }]}
          >
            <ProjectIcon project={project} size={18} />
            <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
              {project.name}
            </Text>
            {unreadProjectIds.has(project.id) ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
          </Pressable>
        );
      })}
      <View style={[styles.sectionRow, styles.recentsRow]}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Recents</Text>
        <Pressable
          onPress={() => setSortOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Sort and filter recents"
          hitSlop={10}
          style={styles.sectionAction}
        >
          <ArrowDownUp size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 8 }]}>
      <FlatList
        data={recents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListHeaderComponent={projectsSection}
        ListEmptyComponent={
          conversations.isPending ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
          ) : conversations.isError ? (
            <Pressable onPress={() => void conversations.refetch()} style={styles.item}>
              <Text style={{ color: colors.danger }}>Could not load conversations. Try again</Text>
            </Pressable>
          ) : allConversations.length > 0 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>No conversations outside projects.</Text>
          ) : (
            <Text style={[styles.hint, { color: colors.muted }]}>No conversations yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const active = pathname === `/c/${item.id}`;
          const showUnread = item.unread && !active;
          return (
            <Pressable
              onPress={() => go(`/c/${item.id}`)}
              onLongPress={() => setMenuFor(item)}
              accessibilityRole="link"
              accessibilityLabel={showUnread ? `${item.title}, unread reply` : item.title}
              style={[styles.item, styles.row, active && { backgroundColor: colors.surfaceStrong }]}
            >
              {item.project ? <ProjectBar color={item.project.color} /> : null}
              <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
                {item.title}
              </Text>
              {showUnread ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
            </Pressable>
          );
        }}
      />

      <ActionSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <Text style={[styles.sheetTitle, { color: colors.muted }]}>Recents</Text>
        <ActionSheetOption
          label="Show project conversations"
          checked={preferences.showProjectConversations}
          onPress={() => {
            setShowProjectConversations(!preferences.showProjectConversations);
            setSortOpen(false);
          }}
        />
      </ActionSheet>

      <ConversationActionsSheet
        conversation={menuFor}
        archived={false}
        onClose={() => setMenuFor(null)}
        onDeleted={(id) => {
          if (pathname === `/c/${id}`) router.navigate("/new");
        }}
      />

      <ProjectActionsSheet
        project={projectMenuFor}
        onClose={() => setProjectMenuFor(null)}
        onEdit={(project) => go(`/projects/form?id=${project.id}` as Href)}
        onDeleted={(projectId) => {
          // A new chat that had this project selected goes back to no project.
          if (params.project === projectId) router.navigate("/new");
        }}
      />

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
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, flexShrink: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: "auto" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: "500" },
  recentsRow: { paddingTop: 16, paddingBottom: 4 },
  sheetTitle: { fontSize: 13, paddingHorizontal: 4, marginBottom: 4 },
  sectionAction: { padding: 4 },
  hint: { padding: 12, fontSize: 14 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, paddingHorizontal: 4, marginTop: "auto" },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
