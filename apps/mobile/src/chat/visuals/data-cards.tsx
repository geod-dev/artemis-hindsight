import { ScrollView, Text, View } from "react-native";
import { usePreferences } from "@/preferences";
import { VisualCard } from "./shared";
import type { ComparisonValue, SpecSheetValue } from "./schemas";

/** Options as columns, traits as rows; the recommended option is highlighted. Scrolls sideways on narrow screens. */
export function ComparisonVisual({ value }: { value: ComparisonValue }) {
  const { colors } = usePreferences();
  const columnWidth = 132;
  return (
    <VisualCard>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: 110 }} />
            {value.options.map((option) => {
              const recommended = option.name === value.recommended;
              return (
                <View key={option.name} style={{ width: columnWidth, padding: 6 }}>
                  <Text style={{ color: recommended ? colors.accent : colors.text, fontWeight: "700" }} numberOfLines={2}>
                    {option.name}
                  </Text>
                  {option.headline ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                      {option.headline}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          {value.traits.map((trait, row) => (
            <View key={trait} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ width: 110, padding: 6, color: colors.muted, fontSize: 13 }}>{trait}</Text>
              {value.options.map((option) => {
                const cell = option.traits[row];
                return (
                  <Text
                    key={option.name}
                    style={{ width: columnWidth, padding: 6, color: cell ? colors.text : colors.muted, fontSize: 13 }}
                  >
                    {cell ? cell : "—"}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      {value.reason ? (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
          <Text style={{ color: colors.accent, fontWeight: "600" }}>{value.recommended} · </Text>
          {value.reason}
        </Text>
      ) : null}
    </VisualCard>
  );
}

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
