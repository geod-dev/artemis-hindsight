import { Text, View } from "react-native";
import { usePreferences } from "@/preferences";
import { VisualCard } from "./shared";
import type { SpecSheetValue } from "./schemas";

/** A spec sheet: a title, an optional subtitle, and label/value rows (emphasised rows in bold). */
export function SpecSheetVisual({ value }: { value: SpecSheetValue }) {
  const { colors } = usePreferences();
  return (
    <VisualCard>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>{value.title}</Text>
      {value.subtitle ? <Text style={{ color: colors.muted, fontSize: 13 }}>{value.subtitle}</Text> : null}
      <View style={{ marginTop: 6 }}>
        {value.rows.map((row) => (
          <View
            key={`${row.label}-${row.value}`}
            style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <Text style={{ color: colors.muted, fontSize: 14, flexShrink: 0 }}>{row.label}</Text>
            <Text style={{ color: colors.text, fontSize: 14, flexShrink: 1, textAlign: "right", fontWeight: row.emphasis ? "700" : "400" }}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </VisualCard>
  );
}
