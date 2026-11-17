import { useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { Column, Row, Text } from "@expo/ui";
import { M3Host } from "@/components/m3";
import { usePreferences } from "@/preferences";
import { VisualCard } from "./shared";
import type { ChartValue } from "./schemas";

const TREND_SIGN: Record<"up" | "down" | "flat", string> = { up: "▲", down: "▼", flat: "" };

/** The direction of the change: the model's `trend` when it gives one, else the sign of the delta text (+4.1% / -2%). */
function directionOf(trend: "up" | "down" | "flat" | undefined, delta: string | undefined): "up" | "down" | "flat" {
  if (trend) return trend;
  const sign = delta?.trim().charAt(0);
  if (sign === "+") return "up";
  if (sign === "-" || sign === "−") return "down";
  return "flat";
}

/**
 * A trend card, as the web chart shows it (`visual__chart`): the label, the headline value with a small coloured delta,
 * and the series. No axes and no rules: the curve carries the story, and the numbers stay in the header. The header is
 * @expo/ui; the curve is react-native-gifted-charts (@expo/ui has no chart).
 */
export function ChartVisual({ value }: { value: ChartValue }) {
  const { colors, isDark } = usePreferences();
  const [width, setWidth] = useState(0);
  const variant = value.variant ?? "area";
  const trend = directionOf(value.trend, value.delta);
  // Green when the change is good for the metric (up, unless up_is_good is false), red when it is bad, grey when flat.
  // The shades are the web's: emerald-600 / red-600 on light, emerald-400 / red-400 on dark.
  const good = value.up_is_good ?? true;
  const goodColor = isDark ? "#34d399" : "#16a34a";
  const badColor = isDark ? "#f87171" : colors.danger;
  const trendColor = trend === "flat" ? colors.muted : (trend === "up") === good ? goodColor : badColor;

  const data = value.points.map((point, index) => ({
    value: point,
    label: value.labels?.[index] ?? "",
    ...(variant === "bars" ? { frontColor: colors.accent } : {}),
  }));
  const chartWidth = Math.max(width - 28, 60);
  // The library's default axis grey is too dark on the dark card; the muted tone is used there only (light is unchanged).
  const axisLabels = isDark ? { xAxisLabelTextStyle: { color: colors.muted }, yAxisTextStyle: { color: colors.muted } } : {};

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <VisualCard>
      <View onLayout={onLayout}>
        <M3Host matchContents={{ vertical: true }}>
          <Column>
            <Text textStyle={{ color: colors.muted }}>{value.label}</Text>
            <Row alignment="center">
              <Text textStyle={{ color: colors.text }}>{value.value}</Text>
              {value.delta ? (
                <Text textStyle={{ color: trendColor }}>{`${TREND_SIGN[trend] ? `${TREND_SIGN[trend]} ` : ""}${value.delta}`}</Text>
              ) : null}
            </Row>
          </Column>
        </M3Host>
        {width > 0 ? (
          <View>
            {variant === "bars" ? (
              <BarChart
                data={data}
                width={chartWidth}
                height={120}
                barWidth={Math.max(8, chartWidth / (data.length * 2))}
                frontColor={colors.accent}
                hideAxesAndRules
                hideYAxisText
                disableScroll
                {...axisLabels}
              />
            ) : (
              <LineChart
                data={data}
                width={chartWidth}
                height={120}
                areaChart={variant === "area"}
                curved
                color={colors.accent}
                startFillColor={colors.accent}
                endFillColor={colors.surface}
                startOpacity={0.3}
                endOpacity={0}
                hideDataPoints
                hideAxesAndRules
                hideYAxisText
                initialSpacing={0}
                endSpacing={0}
                disableScroll
                {...axisLabels}
              />
            )}
          </View>
        ) : null}
      </View>
    </VisualCard>
  );
}
