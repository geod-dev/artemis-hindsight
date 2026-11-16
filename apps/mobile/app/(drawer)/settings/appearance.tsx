import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/preferences";
import type { Appearance } from "@/lib/storage";

const OPTIONS: { value: Appearance; label: string }[] = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** The appearance is kept on this device (the web app keeps it in the browser the same way). */
export default function AppearanceSettings() {
  const { colors, preferences, setAppearance } = usePreferences();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {OPTIONS.map((option) => {
        const selected = preferences.appearance === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => setAppearance(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>{option.label}</Text>
            <Text style={{ color: selected ? colors.accent : colors.muted, fontSize: 16 }}>{selected ? "●" : "○"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 8 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16 },
});
