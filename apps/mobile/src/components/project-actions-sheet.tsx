import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { ApiError } from "@/lib/api";
import { useDeleteProject, useProjects, useSaveProjectOrder, type ProjectSummary } from "@/queries/projects";
import { ActionSheet, ActionSheetOption } from "./action-sheet";

/**
 * The long-press menu of a project in the drawer: move it up or down in the list, edit it, or delete it. The web's
 * sidebar has the same actions, the order by drag and drop. Pass `project` to open it, null to close it.
 */
export function ProjectActionsSheet({
  project,
  onClose,
  onEdit,
  onDeleted,
}: {
  project: ProjectSummary | null;
  onClose: () => void;
  onEdit: (project: ProjectSummary) => void;
  /** Called once the project is deleted. Its conversations stay, outside any project. */
  onDeleted?: (projectId: string) => void;
}) {
  const remove = useDeleteProject();
  const projects = useProjects();
  const saveOrder = useSaveProjectOrder();
  // The sheet keeps the last project while it slides away, so its name does not vanish mid-animation.
  const [shown, setShown] = useState(project);
  useEffect(() => {
    if (project) setShown(project);
  }, [project]);

  // Whether the project has a neighbour in that direction: the option is only offered then.
  const canMove = (target: ProjectSummary, step: -1 | 1) => {
    const ids = (projects.data ?? []).map((project) => project.id);
    const from = ids.indexOf(target.id);
    return from >= 0 && from + step >= 0 && from + step < ids.length;
  };

  // Moves the project one place up or down in the list, by swapping it with its neighbour.
  const moveBy = (target: ProjectSummary, step: -1 | 1) => {
    const ids = (projects.data ?? []).map((project) => project.id);
    const from = ids.indexOf(target.id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    [next[from], next[to]] = [next[to] as string, next[from] as string];
    saveOrder.mutate(next, {
      onError: (error) => Alert.alert("Move failed", error instanceof ApiError ? error.message : "Try again later."),
    });
  };

  const confirmDelete = (target: ProjectSummary) =>
    Alert.alert(
      "Delete project",
      `"${target.name}" and its folder, files and icon will be deleted. Its conversations stay in Recents. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            remove.mutate(target.id, {
              onSuccess: () => onDeleted?.(target.id),
              onError: (error) =>
                Alert.alert("Delete failed", error instanceof ApiError ? error.message : "Try again later."),
            }),
        },
      ],
    );

  return (
    <ActionSheet visible={project !== null} title={shown?.name} onClose={onClose}>
      {shown ? (
        <>
          {canMove(shown, -1) ? (
            <ActionSheetOption
              label="Move up"
              onPress={() => {
                onClose();
                moveBy(shown, -1);
              }}
            />
          ) : null}
          {canMove(shown, 1) ? (
            <ActionSheetOption
              label="Move down"
              onPress={() => {
                onClose();
                moveBy(shown, 1);
              }}
            />
          ) : null}
          <ActionSheetOption
            label="Edit"
            onPress={() => {
              onClose();
              onEdit(shown);
            }}
          />
          <ActionSheetOption
            label="Delete"
            destructive
            onPress={() => {
              onClose();
              confirmDelete(shown);
            }}
          />
        </>
      ) : null}
    </ActionSheet>
  );
}

