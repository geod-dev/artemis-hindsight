import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { paletteHex } from "@/lib/avatar";
import { usePreferences } from "@/preferences";

/** A project as a conversation's top bar shows it: the name in the project's color. Same fields as the web's ProjectRef. */
export interface ProjectRef {
  id: string;
  name: string;
  color: string;
}

/**
 * The title of a conversation in the top bar, with its project's badge after it (the web's ConversationHeading does the
 * same). The badge opens the new chat with that project selected. Used as the stack header's `headerTitle`.
 */
export function ConversationTitleBar({ title, project }: { title: string; project: ProjectRef | null }) {
  const { colors } = usePreferences();
  return (
    <View style={styles.row}>
      <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {project ? <ProjectBadge project={project} /> : null}
    </View>
  );
}

/** The project's badge: its name in a tint of its color. Tapping it opens the new chat in that project. */
export function ProjectBadge({ project }: { project: ProjectRef }) {
  const router = useRouter();
  const { colors } = usePreferences();
  const tint = paletteHex(project.color);
  return (
    <Pressable
      onPress={() => router.navigate(`/new?project=${project.id}` as Href)}
      accessibilityRole="link"
      accessibilityLabel={`New chat in project ${project.name}`}
      hitSlop={6}
      style={[styles.badge, { backgroundColor: `${tint}26`, borderColor: tint }]}
    >
      <View style={[styles.dot, { backgroundColor: tint }]} />
      {/* The name takes the theme's text colour, so it reads in light and dark mode; the project colour is the dot and the edge. */}
      <Text numberOfLines={1} style={[styles.badgeName, { color: colors.text }]}>
        {project.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  // Same size and weight as the header's own title, which a custom headerTitle replaces.
  title: { fontSize: 22, fontWeight: "500", flexShrink: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 160,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeName: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
});
