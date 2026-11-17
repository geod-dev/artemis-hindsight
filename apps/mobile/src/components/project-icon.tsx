import { Image, View } from "react-native";
import { paletteHex } from "@/lib/avatar";
import { projectIconSource, type ProjectSummary } from "@/queries/projects";
import { GlyphView } from "./glyph";

/**
 * A project's icon: its uploaded image, or a filled folder in the project's color when it has none. The web's ProjectIcon
 * (services/web/src/components/projects/project-icon.tsx) does the same. The picture is a React Native Image; the folder is
 * an @expo/ui icon.
 */
export function ProjectIcon({
  project,
  size = 24,
}: {
  project: Pick<ProjectSummary, "id" | "color" | "hasIcon" | "updatedAt">;
  /** The picture's side, in points. The folder takes the icon's own size. */
  size?: number;
}) {
  if (project.hasIcon) {
    return <Image source={projectIconSource(project)} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
  }
  return <GlyphView name="folder" color={paletteHex(project.color)} />;
}

/**
 * A thin vertical bar in the project's color, before a conversation's title. A decorative stripe, not a control: plain
 * React Native (@expo/ui has no equivalent). The web's ProjectBar does the same.
 */
export function ProjectBar({ color, height = 16 }: { color: string; height?: number }) {
  return <View style={{ width: 3, height, borderRadius: 2, backgroundColor: paletteHex(color) }} />;
}
