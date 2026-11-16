import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { usePreferences } from "@/preferences";

/**
 * The model's thinking, as one step of the activity: "Thinking…" while the work runs, "Thought" once it is done. A tap
 * opens the text; the chevron on the right shows it can open.
 */
export function ReasoningPart({ text, live = false }: { text: string; live?: boolean }) {
  const { colors } = usePreferences();
  const [open, setOpen] = useState(false);
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
        <Text style={[styles.label, { color: colors.muted }]}>{live ? "Thinking…" : "Thought"}</Text>
        {hasText ? (
          <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <ChevronDown size={14} color={colors.muted} />
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <Text style={[styles.text, { color: colors.muted }]}>{text}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flex: 1, fontSize: 14, lineHeight: 20 },
  text: { fontSize: 13, lineHeight: 19, marginTop: 6, fontStyle: "italic" },
});
