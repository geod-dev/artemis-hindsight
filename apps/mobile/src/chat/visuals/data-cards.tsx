import { Text, View } from "react-native";
import { Check, Minus } from "lucide-react-native";
import { usePreferences } from "@/preferences";
import { HorizontalRow, VisualCard } from "./shared";
import type { ComparisonValue, SpecSheetValue } from "./schemas";

// The web's comparison card (services/web/src/components/assistant-ui/elements/comparison-card.tsx): one small card per
// option, the recommended one tinted blue with a "pick" badge, each trait a check or a dash. The shades are the web's.
const CARD_WIDTH = 200;
const PICK = { light: "#2563eb", dark: "#60a5fa" };
const PICK_TINT = { light: "rgba(59, 130, 246, 0.07)", dark: "rgba(96, 165, 250, 0.1)" };
const CHECK = { light: "#10b981", dark: "#34d399" };

/** The options as a row of cards that scrolls sideways (as the image group does), and the reason under them. */
export function ComparisonVisual({ value }: { value: ComparisonValue }) {
  const { colors, isDark } = usePreferences();
  const shade = isDark ? "dark" : "light";

  return (
    <View style={{ gap: 8 }}>
      <HorizontalRow gap={10}>
        {value.options.map((option) => {
          const recommended = option.name === value.recommended;
          return (
            <View
              key={option.name}
              style={{
                width: CARD_WIDTH,
                gap: 10,
                padding: 12,
                borderRadius: 14,
                backgroundColor: recommended ? PICK_TINT[shade] : colors.surfaceStrong,
              }}
            >
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: "600" }}>
                    {option.name}
                  </Text>
                  {recommended ? (
                    <Text style={{ color: PICK[shade], fontFamily: "monospace", fontSize: 11 }}>pick</Text>
                  ) : null}
                </View>
                {option.headline ? (
                  <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13 }}>
                    {option.headline}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                {value.traits.map((label, row) => {
                  const trait = option.traits[row];
                  return (
                    <View key={`${row}-${label}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {trait ? <Check size={13} color={CHECK[shade]} /> : <Minus size={13} color={colors.muted} />}
                      <Text
                        numberOfLines={2}
                        style={{ flexShrink: 1, color: trait ? colors.text : colors.muted, fontSize: 13, opacity: trait ? 0.8 : 1 }}
                      >
                        {trait ? trait : label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </HorizontalRow>
      {value.reason ? <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, paddingHorizontal: 2 }}>{value.reason}</Text> : null}
    </View>
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
