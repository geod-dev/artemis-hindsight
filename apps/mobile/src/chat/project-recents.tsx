import { ActivityIndicator, Pressable, View } from "react-native";
import { Button, Row, RNHostView, Text } from "@expo/ui";
import { useRouter, type Href } from "expo-router";
import { M3Host } from "@/components/m3";
import { ProjectBar } from "@/components/project-icon";
import { useProjectRecents } from "@/queries/projects";
import { usePreferences } from "@/preferences";

/**
 * The selected project's most recent conversations, under the new chat's composer: four of them, and "See more" for the
 * whole list. The web's ProjectRecents (services/web/src/components/projects/project-recents.tsx) shows the same.
 * The rows are React Native touch targets; their content is @expo/ui.
 */
export function ProjectRecents({ projectId }: { projectId: string }) {
  const { colors } = usePreferences();
  const router = useRouter();
  const recents = useProjectRecents(projectId, true);

  if (recents.isPending) {
    return (
      <M3Host matchContents>
        <RNHostView matchContents>
          <ActivityIndicator color={colors.accent} />
        </RNHostView>
      </M3Host>
    );
  }
  if (recents.isError) {
    return (
      <M3Host matchContents>
        <Text textStyle={{ color: colors.danger }}>The conversations could not be loaded.</Text>
      </M3Host>
    );
  }
  const { conversations, total } = recents.data;
  if (conversations.length === 0) {
    return (
      <M3Host matchContents>
        <Text>No conversations in this project yet.</Text>
      </M3Host>
    );
  }

  return (
    <View>
      <M3Host matchContents>
        <Text>Recents</Text>
      </M3Host>
      {conversations.map((conversation) => (
        <Pressable
          key={conversation.id}
          onPress={() => router.navigate(`/c/${conversation.id}`)}
          accessibilityRole="link"
          accessibilityLabel={conversation.unread ? `${conversation.title}, unread reply` : conversation.title}
        >
          <M3Host matchContents={{ vertical: true }}>
            <Row alignment="center">
              {conversation.project ? (
                <RNHostView matchContents>
                  <ProjectBar color={conversation.project.color} />
                </RNHostView>
              ) : null}
              <Text>{conversation.title}</Text>
              {conversation.unread ? (
                <RNHostView matchContents>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                </RNHostView>
              ) : null}
            </Row>
          </M3Host>
        </Pressable>
      ))}
      {total > conversations.length ? (
        <M3Host matchContents>
          <Button
            variant="text"
            label="See more"
            // The project's full list is a route added with this change: typed routes learn it on the next type generation.
            onPress={() => router.navigate(`/projects/${projectId}` as Href)}
          />
        </M3Host>
      ) : null}
    </View>
  );
}
