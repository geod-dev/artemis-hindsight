import { StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/preferences";
import { thinkingText, useElapsed } from "./thinking-label";

/**
 * The model's thinking, as one step of the activity: "Thinking 3s" while it runs, "Thought for 4s" once it has ended. Like the
 * web app, it is a plain label: the thinking itself is not shown.
 */
export function ReasoningPart({
  live = false,
  startedAt,
  endedAt,
}: {
  live?: boolean;
  startedAt?: number;
  endedAt?: number;
}) {
  const { colors } = usePreferences();
  const elapsed = useElapsed(startedAt, live);
  const durationMs = startedAt !== undefined && endedAt !== undefined ? endedAt - startedAt : undefined;
  return (
    <View>
      <Text style={[styles.label, { color: colors.muted }]}>{thinkingText(live ? elapsed : durationMs, live)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
});
