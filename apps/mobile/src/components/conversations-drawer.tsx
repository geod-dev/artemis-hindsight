import { Button, Column, RNHostView, Row, Text } from "@expo/ui";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { useGlobalSearchParams, usePathname, useRouter, type Href } from "expo-router";
import { setReturnTo } from "@/lib/return-to";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { useState } from "react";
import { useAuth } from "@/auth";
import { ActionSheet, ActionSheetOption } from "@/components/action-sheet";
import { ConversationActionsSheet } from "@/components/conversation-actions-sheet";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { ProjectActionsSheet } from "@/components/project-actions-sheet";
import { ProjectBar, ProjectIcon } from "@/components/project-icon";
import { useNewChatProjectSelection } from "@/chat/new-chat-selection";
import { useConversations, type ConversationSummary } from "@/queries/conversations";
import { useProjects, type ProjectSummary } from "@/queries/projects";
import { usePreferences } from "@/preferences";
import { avatarHex, initialsOf } from "@/lib/avatar";

/**
 * The web app's sidebar: the Projects (each opens a new chat with that project selected), the Recents conversations,
 * then the account and the new chat button. Long press on a project or a conversation opens its menu.
 *
 * The rows are React Native touch targets (long press is not available in @expo/ui); what they show is @expo/ui.
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
  // The project the new chat has selected, whether its picker or a row here chose it: the row of that project is highlighted.
  const pickedProject = useNewChatProjectSelection();
  const selectedProject = pathname === "/new" ? pickedProject : undefined;

  const projectsSection = (
    <M3Host matchContents={{ vertical: true }}>
      <Column>
        <Row alignment="center">
          <Text>Projects</Text>
          <Button variant="text" onPress={() => go("/projects/form" as Href)}>
            <Glyph name="add" />
          </Button>
        </Row>
        {projects.data?.length === 0 ? <Text>No projects yet.</Text> : null}
      </Column>
    </M3Host>
  );

  const recentsHeader = (
    <M3Host matchContents={{ vertical: true }}>
      <Row alignment="center">
        <Text>Recents</Text>
        <Button variant="text" onPress={() => setSortOpen(true)}>
          <Glyph name="sort" />
        </Button>
      </Row>
    </M3Host>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <FlatList
        data={recents}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {projectsSection}
            {projects.data?.map((project) => {
              const active = selectedProject === project.id;
              return (
                <Pressable
                  key={project.id}
                  onPress={() => openProject(project.id)}
                  onLongPress={() => setProjectMenuFor(project)}
                  accessibilityRole="link"
                  accessibilityLabel={unreadProjectIds.has(project.id) ? `${project.name}, unread reply` : project.name}
                  style={active ? { backgroundColor: `${colors.accent}1f` } : undefined}
                >
                  <M3Host matchContents={{ vertical: true }}>
                    <Row alignment="center">
                      <RNHostView matchContents>
                        <ProjectIcon project={project} />
                      </RNHostView>
                      <Text>{project.name}</Text>
                    </Row>
                  </M3Host>
                  {unreadProjectIds.has(project.id) ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
                </Pressable>
              );
            })}
            {recentsHeader}
          </View>
        }
        ListEmptyComponent={
          <M3Host matchContents={{ vertical: true }}>
            {conversations.isPending ? (
              <RNHostView matchContents>
                <ActivityIndicator color={colors.accent} />
              </RNHostView>
            ) : conversations.isError ? (
              <Button variant="text" label="Could not load conversations. Try again" onPress={() => void conversations.refetch()} />
            ) : allConversations.length > 0 ? (
              <Text>No conversations outside projects.</Text>
            ) : (
              <Text>No conversations yet.</Text>
            )}
          </M3Host>
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
              style={active ? { backgroundColor: `${colors.accent}1f` } : undefined}
            >
              <M3Host matchContents={{ vertical: true }}>
                <Row alignment="center">
                  {item.project ? (
                    <RNHostView matchContents>
                      <ProjectBar color={item.project.color} />
                    </RNHostView>
                  ) : null}
                  <Text>{item.title}</Text>
                </Row>
              </M3Host>
              {showUnread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
            </Pressable>
          );
        }}
      />

      <ActionSheet visible={sortOpen} title="Recents" onClose={() => setSortOpen(false)}>
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
      <M3Host matchContents={{ vertical: true }}>
        <Row alignment="center">
          <Pressable
            onPress={() => go("/settings")}
            accessibilityRole="link"
            accessibilityLabel="Account and settings"
            style={{ backgroundColor: user ? avatarHex(user.avatarColor, user.username) : colors.muted, borderRadius: 999 }}
          >
            <M3Host matchContents>
              <Text textStyle={{ color: "#ffffff" }}>{user ? initialsOf(user.displayName ?? user.username) : "?"}</Text>
            </M3Host>
          </Pressable>
          <Button variant="filled" style={{ backgroundColor: colors.accent }} onPress={() => go(`/new?session=${Date.now()}`)}>
            <Row alignment="center">
              <Glyph name="add" color={colors.onUser} />
              <Text textStyle={{ color: colors.onUser }}>New Chat</Text>
            </Row>
          </Button>
        </Row>
      </M3Host>
    </View>
  );
}
