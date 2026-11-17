import { ScrollView } from "react-native";
import { Column, Row, Text } from "@expo/ui";
import { usePreferences } from "@/preferences";
import { M3Host } from "@/components/m3";
import { VisualCard } from "./shared";
import type { ComparisonValue, SpecSheetValue } from "./schemas";

/** Options as columns, traits as rows; the recommended option is highlighted. Scrolls sideways on narrow screens. */
export function ComparisonVisual({ value }: { value: ComparisonValue }) {
  const { colors } = usePreferences();
  return (
    <VisualCard>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <M3Host matchContents>
          <Column>
            <Row>
              <Text> </Text>
              {value.options.map((option) => {
                const recommended = option.name === value.recommended;
                return (
                  <Column key={option.name}>
                    <Text textStyle={{ color: recommended ? colors.accent : colors.text }}>{option.name}</Text>
                    {option.headline ? <Text textStyle={{ color: colors.muted }}>{option.headline}</Text> : null}
                  </Column>
                );
              })}
            </Row>
            {value.traits.map((trait, row) => (
              <Row key={trait}>
                <Text textStyle={{ color: colors.muted }}>{trait}</Text>
                {value.options.map((option) => {
                  const cell = option.traits[row];
                  return <Text key={option.name}>{cell ? cell : "—"}</Text>;
                })}
              </Row>
            ))}
          </Column>
        </M3Host>
      </ScrollView>
      {value.reason ? (
        <M3Host matchContents={{ vertical: true }}>
          <Text textStyle={{ color: colors.muted }}>{`${value.recommended} · ${value.reason}`}</Text>
        </M3Host>
      ) : null}
    </VisualCard>
  );
}

/** A spec sheet: a title, an optional subtitle, and label/value rows (emphasised rows in bold). */
export function SpecSheetVisual({ value }: { value: SpecSheetValue }) {
  const { colors } = usePreferences();
  return (
    <VisualCard>
      <M3Host matchContents={{ vertical: true }}>
        <Column>
          <Text>{value.title}</Text>
          {value.subtitle ? <Text textStyle={{ color: colors.muted }}>{value.subtitle}</Text> : null}
          {value.rows.map((row) => (
            <Row key={`${row.label}-${row.value}`}>
              <Text textStyle={{ color: colors.muted }}>{row.label}</Text>
              <Text>{row.value}</Text>
            </Row>
          ))}
        </Column>
      </M3Host>
    </VisualCard>
  );
}
