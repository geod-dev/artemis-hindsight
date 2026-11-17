import { Button, Row, RNHostView, Text } from "@expo/ui";
import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import { ActionSheet, ActionSheetOption } from "@/components/action-sheet";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { ProjectIcon } from "@/components/project-icon";
import type { ProjectSummary } from "@/queries/projects";

/**
 * The project of the new chat, under the mascot and above the composer, as the web's new chat does.
 *  - No project selected: a button reading "Select project". Tapping it opens the same bottom sheet as a conversation's
 *    long-press menu: "No project" (closes it), the projects, then "New project", which opens the project form. A project
 *    saved there opens its new chat with the project selected.
 *  - A project selected: a button with its icon and name, and a close glyph. Tapping it removes the project. There is no
 *    reselector meanwhile: to change, remove the project, then pick another.
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
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (selected) {
    return (
      <M3Host matchContents>
        <Button variant="outlined" onPress={onRemove}>
          <Row alignment="center">
            <RNHostView matchContents>
              <ProjectIcon project={selected} />
            </RNHostView>
            <Text>{selected.name}</Text>
            <Glyph name="close" />
          </Row>
        </Button>
      </M3Host>
    );
  }

  return (
    <>
      <M3Host matchContents>
        <Button variant="outlined" label="Select project" onPress={() => setOpen(true)} />
      </M3Host>

      <ActionSheet visible={open} title="Project" onClose={() => setOpen(false)}>
        <ActionSheetOption label="No project" onPress={() => setOpen(false)} />
        {projects.map((project) => (
          <ActionSheetOption
            key={project.id}
            label={project.name}
            icon={<ProjectIcon project={project} size={24} />}
            onPress={() => {
              setOpen(false);
              onSelect(project.id);
            }}
          />
        ))}
        <ActionSheetOption
          label="New project"
          icon="add"
          onPress={() => {
            setOpen(false);
            router.push("/projects/form" as Href);
          }}
        />
      </ActionSheet>
    </>
  );
}
