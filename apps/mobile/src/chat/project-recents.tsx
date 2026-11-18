import { useRouter, type Href } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ProjectBar } from "@/components/project-icon";
import { useProjectRecents } from "@/queries/projects";
import { usePreferences } from "@/preferences";

/**
 * The selected project's most recent conversations, under the new chat's composer: four of them, and "See more" for the
 * whole list. The web's ProjectRecents (services/web/src/components/projects/project-recents.tsx) shows the same.
 */
export function ProjectRecents({ projectId }: { projectId: string }) {
  const { colors } = usePreferences();
  const router = useRouter();
  const recents = useProjectRecents(projectId, true);

  if (recents.isPending) {
    return <ActivityIndicator style={styles.loading} color={colors.accent} />;
  }
  if (recents.isError) {
    return <Text style={[styles.hint, { color: colors.danger }]}>The conversations could not be loaded.</Text>;
  }
  const { conversations, total } = recents.data;
  if (conversations.length === 0) {
    return <Text style={[styles.hint, { color: colors.muted }]}>No conversations in this project yet.</Text>;
  }

  return (
    <View style={styles.box}>
      <Text style={[styles.label, { color: colors.muted }]}>Recents</Text>
      {conversations.map((conversation) => (
        <Pressable
          key={conversation.id}
          onPress={() => router.navigate(`/c/${conversation.id}`)}
          accessibilityRole="link"
          accessibilityLabel={conversation.unread ? `${conversation.title}, unread reply` : conversation.title}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceStrong }]}
        >
          {conversation.project ? <ProjectBar color={conversation.project.color} /> : null}
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
            {conversation.title}
          </Text>
          {conversation.running ? (
            <ActivityIndicator size="small" color={colors.muted} accessibilityLabel="Reply running" />
          ) : conversation.unread ? (
            <View style={[styles.unread, { backgroundColor: colors.accent }]} />
          ) : null}
        </Pressable>
      ))}
      {total > conversations.length ? (
        <Pressable
          // The project's full list is a route added with this change: typed routes learn it on the next type generation.
          onPress={() => router.navigate(`/projects/${projectId}` as Href)}
          accessibilityRole="button"
          style={styles.more}
        >
          <Text style={[styles.moreText, { color: colors.accent }]}>See more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", gap: 2, paddingHorizontal: 8, paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: "500", paddingHorizontal: 8, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  title: { flexShrink: 1, fontSize: 15 },
  unread: { width: 8, height: 8, borderRadius: 4 },
  more: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 8 },
  moreText: { fontSize: 14, fontWeight: "600" },
  hint: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
  loading: { paddingVertical: 12 },
});
