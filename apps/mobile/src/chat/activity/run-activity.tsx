import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
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
    <View style={styles.root}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.trigger}
      >
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <ChevronRight size={14} color={colors.muted} />
        </View>
        <Text style={[styles.summary, { color: colors.muted }]}>{summary}</Text>
      </Pressable>
      {!open && running && latest ? (
        <Text numberOfLines={1} style={[styles.latest, { color: colors.muted }]}>
          {latest}
        </Text>
      ) : null}
      {open ? (
        <View style={[styles.timeline, { borderLeftColor: colors.border }]}>
          {entries.map((entry) => (
            <View key={entry.id}>{entry.content}</View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  trigger: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, alignSelf: "flex-start" },
  summary: { fontSize: 14, fontVariant: ["tabular-nums"] },
  latest: { fontSize: 13, paddingLeft: 18 },
  timeline: { marginLeft: 6, paddingLeft: 14, paddingTop: 6, paddingBottom: 4, gap: 12, borderLeftWidth: StyleSheet.hairlineWidth },
});
