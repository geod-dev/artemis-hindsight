import { useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
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
 * and the series. No axes and no rules: the curve carries the story, and the numbers stay in the header.
 */
export function ChartVisual({ value }: { value: ChartValue }) {
  const { colors } = usePreferences();
  const [width, setWidth] = useState(0);
  const variant = value.variant ?? "area";
  const trend = directionOf(value.trend, value.delta);
  // Green when the change is good for the metric (up, unless up_is_good is false), red when it is bad, grey when flat.
  const good = value.up_is_good ?? true;
  const trendColor = trend === "flat" ? colors.muted : (trend === "up") === good ? "#16a34a" : colors.danger;

  const data = value.points.map((point, index) => ({
    value: point,
    label: value.labels?.[index] ?? "",
    ...(variant === "bars" ? { frontColor: colors.accent } : {}),
  }));
  const chartWidth = Math.max(width - 28, 60);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <VisualCard>
      <View onLayout={onLayout}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{value.label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "600" }}>{value.value}</Text>
          {value.delta ? (
            <View style={{ backgroundColor: `${trendColor}1f`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: trendColor, fontSize: 12, fontWeight: "600" }}>
                {TREND_SIGN[trend] ? `${TREND_SIGN[trend]} ` : ""}
                {value.delta}
              </Text>
            </View>
          ) : null}
        </View>
        {width > 0 ? (
          <View style={{ marginTop: 10 }}>
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
              />
            )}
          </View>
        ) : null}
      </View>
    </VisualCard>
  );
}
