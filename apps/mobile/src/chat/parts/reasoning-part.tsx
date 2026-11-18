import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { usePreferences } from "@/preferences";
import { thinkingText, useElapsed } from "./thinking-label";

/**
 * The model's thinking, as one step of the activity: "Thinking 3s" while it runs, "Thought for 4s" once it has ended (the
 * web app's words). A tap opens the text; the chevron on the right shows it can open.
 */
export function ReasoningPart({
  text,
  live = false,
  startedAt,
  endedAt,
}: {
  text: string;
  live?: boolean;
  startedAt?: number;
  endedAt?: number;
}) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
  const elapsed = useElapsed(startedAt, live);
  const durationMs = startedAt !== undefined && endedAt !== undefined ? endedAt - startedAt : undefined;
  const hasText = text.trim() !== "";
  return (
    <View>
      <Pressable
        onPress={() => hasText && setOpen((value) => !value)}
        disabled={!hasText}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: !hasText }}
        style={styles.row}
      >
        <Text style={[styles.label, { color: colors.muted }]}>{thinkingText(live ? elapsed : durationMs, live)}</Text>
        {hasText ? (
          <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <ChevronDown size={14} color={colors.muted} />
          </View>
        ) : null}
      </Pressable>
      {open ? <Text style={[styles.text, { color: colors.muted }]}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flex: 1, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
  text: { fontSize: 13, lineHeight: 19, marginTop: 6, fontStyle: "italic" },
});
