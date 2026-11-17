import { Button, Row, Text } from "@expo/ui";
import { useRouter, type Href } from "expo-router";
import { paletteHex } from "@/lib/avatar";
import { M3Host } from "./m3";

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
  return (
    <M3Host matchContents>
      <Row alignment="center">
        <Text>{title}</Text>
        {project ? <ProjectBadge project={project} /> : null}
      </Row>
    </M3Host>
  );
}

/** The project's badge: its name in a tint of its color. Tapping it opens the new chat in that project. */
export function ProjectBadge({ project }: { project: ProjectRef }) {
  const router = useRouter();
  const tint = paletteHex(project.color);
  return (
    <Button variant="outlined" onPress={() => router.navigate(`/new?project=${project.id}` as Href)}>
      <Text textStyle={{ color: tint }}>{project.name}</Text>
    </Button>
  );
}
