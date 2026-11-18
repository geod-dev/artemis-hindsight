import { Pressable, StyleSheet, View } from "react-native";
import { AVATAR_COLOR_IDS, AVATAR_COLORS, type AvatarColorId } from "@/lib/avatar";
import { usePreferences } from "@/preferences";

/**
 * The palette of the avatar colors as a row of swatches: the profile's avatar color and a project's color. The same
 * palette and the same look as the web's ColorSwatches (services/web/src/components/profile/color-swatches.tsx).
 */
export function ColorSwatches({
  value,
  onChange,
  disabled = false,
}: {
  value: AvatarColorId | null;
  onChange: (color: AvatarColorId) => void;
  disabled?: boolean;
}) {
  const { colors } = usePreferences();
  return (
    <View style={styles.swatches} accessibilityRole="radiogroup">
      {AVATAR_COLOR_IDS.map((id) => {
        const selected = value === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityLabel={id}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(id)}
            style={[
              styles.swatch,
              { backgroundColor: AVATAR_COLORS[id] },
              selected && { borderWidth: 3, borderColor: colors.text },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 20 },
});
