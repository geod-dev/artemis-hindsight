import { ListItem, ScrollView, Text, Column } from "@expo/ui";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { usePreferences } from "@/preferences";
import type { Appearance } from "@/lib/storage";

const OPTIONS: { value: Appearance; label: string }[] = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** The appearance is kept on this device (the web app keeps it in the browser the same way). */
export default function AppearanceSettings() {
  const { preferences, setAppearance } = usePreferences();
  return (
    <M3Host style={{ flex: 1 }}>
      <ScrollView>
        <Column>
          {OPTIONS.map((option) => {
            const selected = preferences.appearance === option.value;
            return (
              <ListItem key={option.value} onPress={() => setAppearance(option.value)}>
                <Text>{option.label}</Text>
                {selected ? (
                  <ListItem.Trailing>
                    <Glyph name="check" />
                  </ListItem.Trailing>
                ) : null}
              </ListItem>
            );
          })}
        </Column>
      </ScrollView>
    </M3Host>
  );
}
