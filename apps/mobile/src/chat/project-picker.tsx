import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter, type Href } from "expo-router";
import { X } from "lucide-react-native";
import { ActionSheet, ActionSheetOption } from "@/components/action-sheet";
import { ProjectIcon } from "@/components/project-icon";
import { paletteHex } from "@/lib/avatar";
import type { ProjectSummary } from "@/queries/projects";
import { usePreferences } from "@/preferences";

/**
 * The project of the new chat, under the mascot and above the composer, as the web's new chat does.
 *  - No project selected: a centered pill reading "Select project". Tapping it opens the same bottom sheet as a
 *    conversation's long-press menu: "No project" (closes it), the projects, then "New project", which opens the
 *    project form. A project saved there opens its new chat with the project selected.
 *  - A project selected: a badge in the project's color (its icon or folder, its name). The whole badge removes the
 *    project. There is no reselector meanwhile: to change, remove the project, then pick another.
 * The picker is placed by the caller in the empty state only.
 */
export function ProjectPicker({
  projects,
  selected,
  onSelect,
  onRemove,
}: {
  projects: ProjectSummary[];
  selected: ProjectSummary | null;
  onSelect: (projectId: string) => void;
  onRemove: () => void;
}) {
  const { colors } = usePreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (selected) {
    const tint = paletteHex(selected.color);
    return (
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove project ${selected.name}`}
        style={[styles.badge, { backgroundColor: `${tint}26`, borderColor: tint }]}
      >
        <ProjectIcon project={selected} size={18} />
        <Text numberOfLines={1} style={[styles.badgeName, { color: colors.text }]}>
          {selected.name}
        </Text>
        <X size={16} color={colors.muted} />
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Select project"
        style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={[styles.pillText, { color: colors.text }]}>Select project</Text>
      </Pressable>

      <ActionSheet visible={open} title="Project" onClose={() => setOpen(false)}>
        <ActionSheetOption label="No project" onPress={() => setOpen(false)} />
        {projects.map((project) => (
          <ActionSheetOption
            key={project.id}
            label={project.name}
            icon={<ProjectIcon project={project} size={20} />}
            onPress={() => {
              setOpen(false);
              onSelect(project.id);
            }}
          />
        ))}
        <ActionSheetOption
          label="New project"
          onPress={() => {
            setOpen(false);
            router.push("/projects/form" as Href);
          }}
        />
      </ActionSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillText: { fontSize: 14, fontWeight: "500" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 280,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 10,
  },
  badgeName: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
