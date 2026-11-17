import { Image, View } from "react-native";
import { Folder } from "lucide-react-native";
import { paletteHex } from "@/lib/avatar";
import { projectIconSource, type ProjectSummary } from "@/queries/projects";

/**
 * A project's icon: its uploaded image, or a filled folder in the project's color when it has none. The web's ProjectIcon
 * (services/web/src/components/projects/project-icon.tsx) does the same.
 */
export function ProjectIcon({
  project,
  size = 20,
}: {
  project: Pick<ProjectSummary, "id" | "color" | "hasIcon" | "updatedAt">;
  size?: number;
}) {
  if (project.hasIcon) {
    return <Image source={projectIconSource(project)} style={{ width: size, height: size, borderRadius: 4 }} accessibilityIgnoresInvertColors />;
  }
  return <Folder size={size} color={paletteHex(project.color)} fill={paletteHex(project.color)} />;
}

/** A thin vertical bar in the project's color, before a conversation's title. The web's ProjectBar does the same. */
export function ProjectBar({ color, height = 16 }: { color: string; height?: number }) {
  return <View style={{ width: 3, height, borderRadius: 2, backgroundColor: paletteHex(color) }} />;
}
