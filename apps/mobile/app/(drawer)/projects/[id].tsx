import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BackButton } from "@/components/back-button";
import { ProjectBar } from "@/components/project-icon";
import { useProjectConversationPages, useProjects } from "@/queries/projects";
import { usePreferences } from "@/preferences";

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * "See more" of a project's recents: every conversation of the project, most recent first, in a topbar named after the
 * project. Pages load as the list is scrolled. Back returns to the project's new chat (the web's "See more" expands the
 * list under the composer instead, ten at a time).
 */
export default function ProjectConversationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = usePreferences();
  const project = useProjects().data?.find((candidate) => candidate.id === id);
  const pages = useProjectConversationPages(id);
  const items = useMemo(() => pages.data?.pages.flatMap((page) => page.conversations) ?? [], [pages.data]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: project?.name ?? "Project",
      headerLeft: () => <BackButton to={`/new?project=${id}&session=${Date.now()}`} />,
    });
  }, [navigation, project?.name, id]);

  if (pages.isPending) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (pages.isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>The conversations could not be loaded.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No conversations in this project yet.</Text>}
      ListFooterComponent={pages.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.accent} /> : undefined}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage();
      }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.navigate(`/c/${item.id}`)}
          accessibilityRole="link"
          accessibilityLabel={item.title}
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceStrong : colors.surface }]}
        >
          <View style={styles.titleLine}>
            {project ? <ProjectBar color={project.color} /> : null}
            <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
              {item.title}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.muted }]}>{dayFormat.format(new Date(item.updatedAt))}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 12, gap: 8 },
  row: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, flexShrink: 1 },
  date: { fontSize: 13 },
  empty: { padding: 24, textAlign: "center", fontSize: 15 },
  footer: { paddingVertical: 16 },
});
