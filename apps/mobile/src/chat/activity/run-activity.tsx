import { Row, Text } from "@expo/ui";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { usePreferences } from "@/preferences";

// The turn's work, as the web app shows it (services/web/src/components/assistant-ui/elements/run-activity.tsx): one quiet
// line with a chevron ("Working 5s" while it runs, "Worked for 5m 32s" when done). Open, the steps sit on a thin timeline.
// While it runs and the line is closed, the latest step shows under it.

export interface ActivityEntry {
  id: string;
  content: ReactNode;
}

export function RunActivity({
  statusLabel,
  durationLabel,
  latest,
  running,
  entries,
}: {
  statusLabel: string;
  durationLabel?: string;
  latest?: string;
  running: boolean;
  entries: readonly ActivityEntry[];
}) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
  const summary = durationLabel ? `${statusLabel} ${durationLabel}` : statusLabel;

  return (
    <View>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <M3Host matchContents={{ vertical: true }}>
          <Row alignment="center">
            <Glyph name={open ? "chevronDown" : "chevronRight"} />
            <Text>{summary}</Text>
          </Row>
        </M3Host>
      </Pressable>
      {!open && running && latest ? (
        <M3Host matchContents={{ vertical: true }}>
          <Text>{latest}</Text>
        </M3Host>
      ) : null}
      {open ? (
        // The timeline: a thin rule down the left of the steps (a decoration, not a control: plain React Native).
        <View style={{ borderLeftWidth: 1, borderLeftColor: colors.muted }}>
          {entries.map((entry) => (
            <View key={entry.id}>{entry.content}</View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
