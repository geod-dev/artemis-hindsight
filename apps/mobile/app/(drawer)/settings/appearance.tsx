import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { usePreferences } from "@/preferences";
import type { Appearance } from "@/lib/storage";

const OPTIONS: { value: Appearance; label: string }[] = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** The appearance is kept on this device (the web app keeps it in the browser the same way). */
export default function AppearanceSettings() {
  const { colors, preferences, setAppearance, setShowProjects } = usePreferences();
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

      {/* The web's appearance page has the same switch for its sidebar. */}
      <Text style={[styles.section, { color: colors.muted }]}>Drawer</Text>
      <View style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.optionText}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Show projects</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>When off, Recents lists every conversation, project ones included.</Text>
        </View>
        <Switch
          value={preferences.showProjects}
          onValueChange={setShowProjects}
          accessibilityLabel="Show projects"
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.background}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 8 },
  section: { fontSize: 13, fontWeight: "500", marginTop: 16, marginBottom: 4, paddingHorizontal: 4 },
  optionText: { flex: 1, gap: 2, marginRight: 12 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16 },
});
