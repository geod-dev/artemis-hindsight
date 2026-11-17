import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { Button, Column, Row, RNHostView, Text } from "@expo/ui";
import { BackButton } from "@/components/back-button";
import { M3Host } from "@/components/m3";
import { ProjectBar } from "@/components/project-icon";
import { useProjectConversationPages, useProjects } from "@/queries/projects";
import { usePreferences } from "@/preferences";

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * "See more" of a project's recents: every conversation of the project, most recent first, in a topbar named after the
 * project. Pages load as the list is scrolled. Back returns to the project's new chat (the web's "See more" expands the
 * list under the composer instead, ten at a time). The rows are React Native touch targets; their content is @expo/ui.
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (pages.isError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <M3Host matchContents>
          <Text textStyle={{ color: colors.danger }}>The conversations could not be loaded.</Text>
        </M3Host>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      ListEmptyComponent={
        <M3Host matchContents>
          <Text textStyle={{ color: colors.muted }}>No conversations in this project yet.</Text>
        </M3Host>
      }
      ListFooterComponent={
        pages.isFetchingNextPage ? (
          <RNHostView matchContents>
            <ActivityIndicator color={colors.accent} />
          </RNHostView>
        ) : undefined
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage();
      }}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.navigate(`/c/${item.id}`)} accessibilityRole="link" accessibilityLabel={item.title}>
          <M3Host matchContents={{ vertical: true }}>
            <Column>
              <Row alignment="center">
                {project ? (
                  <RNHostView matchContents>
                    <ProjectBar color={project.color} />
                  </RNHostView>
                ) : null}
                <Text>{item.title}</Text>
              </Row>
              <Text textStyle={{ color: colors.muted }}>{dayFormat.format(new Date(item.updatedAt))}</Text>
            </Column>
          </M3Host>
        </Pressable>
      )}
    />
  );
}
