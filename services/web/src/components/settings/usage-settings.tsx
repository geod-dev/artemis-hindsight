"use client";

import { useEffect, useState } from "react";
import { StackedBarChart, type BarRow } from "@/components/charts/stacked-bar-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { paletteColorCss, type AvatarColorId } from "@/lib/avatar-colors";
import {
  co2Equivalent,
  DEFAULT_USAGE_RANGE,
  USAGE_PARTS,
  USAGE_RANGES,
  USAGE_UNITS,
  valueIn,
  valueOfPart,
  type UsagePart,
  type UsageRange,
  type UsageUnit,
} from "@/lib/usage";
import type { UsageReport } from "@/server/usage/usage-service";
import { SettingsPage } from "./settings-page";

const count = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdSmall = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 2 });
const eur = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" });
const eurSmall = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumSignificantDigits: 2 });

/**
 * Money with no floor: a whole cent or more shows two decimals, a smaller amount shows its first two significant digits,
 * so a tiny cost never reads as zero.
 */
function money(full: Intl.NumberFormat, small: Intl.NumberFormat, value: number): string {
  return value === 0 || Math.abs(value) >= 0.01 ? full.format(value) : small.format(value);
}

/** CO2 with no floor: a gram or more shows one decimal, a smaller amount its first two significant digits. */
function co2(grams: number): string {
  if (grams === 0) return "0 g CO2e";
  return `${grams >= 1 ? grams.toFixed(1) : grams.toPrecision(2)} g CO2e`;
}

/** A value in the chosen unit, written with its unit. */
function format(unit: UsageUnit, value: number): string {
  switch (unit) {
    case "tokens":
      return `${count.format(Math.round(value))} tokens`;
    case "usd":
      return money(usd, usdSmall, value);
    case "eur":
      return money(eur, eurSmall, value);
    case "co2":
      return co2(value);
  }
}

/** One palette color per part, from the project's own palette (the avatar colors). */
const PART_COLOR: Record<UsagePart, AvatarColorId> = {
  input: "blue",
  output: "orange",
  image: "emerald",
  memory: "pink",
};

export function UsageSettings() {
  const [range, setRange] = useState<UsageRange>(DEFAULT_USAGE_RANGE);
  const [unit, setUnit] = useState<UsageUnit>("tokens");
  // Each answer is kept with the period it was asked for, so a period switch shows a skeleton until its answer comes.
  const [report, setReport] = useState<UsageReport | null>(null);
  const [failure, setFailure] = useState<{ range: UsageRange; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/usage?range=${range}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setReport((await res.json()) as UsageReport);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({ range, message: cause instanceof Error ? cause.message : String(cause) });
      });
    return () => controller.abort();
  }, [range]);

  const data = report?.range === range ? report : null;
  const failed = failure?.range === range ? failure.message : null;

  return (
    <SettingsPage
      title="Usage"
      description="What your conversations consume: tokens, what they cost, and their CO2 footprint."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={range} onValueChange={(value) => setRange(value as UsageRange)}>
          <TabsList>
            {USAGE_RANGES.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={unit} onValueChange={(value) => setUnit(value as UsageUnit)}>
          <TabsList>
            {USAGE_UNITS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {failed && <p className="text-sm text-destructive">The usage could not be loaded: {failed}.</p>}
      {!failed && !data && <Skeleton className="h-72 w-full rounded-xl" />}
      {data && <Chart unit={unit} report={data} />}
    </SettingsPage>
  );
}

/** The CO2 total as something everyday: a kettle, a drive, a flight... */
function Co2Equivalent({ grams }: { grams: number }) {
  const { icon, text } = co2Equivalent(grams);
  return (
    <p className="text-sm text-muted-foreground">
      <span aria-hidden className="me-1.5">
        {icon}
      </span>
      {text}
    </p>
  );
}

/** One bar per hour, day, month or year, filled with its parts (input at the bottom). The shared bar chart draws it. */
function Chart({ unit, report }: { unit: UsageUnit; report: UsageReport }) {
  const rows: BarRow[] = report.buckets.map((bucket) => {
    const row: BarRow = { name: bucket.label };
    for (const { id } of USAGE_PARTS) row[id] = valueOfPart(unit, bucket.parts[id]);
    return row;
  });
  const series = USAGE_PARTS.map(({ id, label }) => ({ key: id, label, color: paletteColorCss(PART_COLOR[id]) }));
  const hasUsage = report.buckets.some((bucket) => bucket.turns > 0 || USAGE_PARTS.some(({ id }) => bucket.parts[id].tokens > 0));

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{format(unit, valueIn(unit, report.totals))}</p>
          {unit === "co2" && <Co2Equivalent grams={valueIn("co2", report.totals)} />}
        </div>

        {hasUsage ? (
          <div className="h-56">
            <StackedBarChart
              data={rows}
              series={series}
              formatValue={(value) => format(unit, value)}
            />
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">Nothing was used in this period.</p>
        )}

        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {USAGE_PARTS.filter(({ id }) => valueOfPart(unit, report.totals.parts[id]) > 0).map(({ id, label }) => (
            <li key={id} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: paletteColorCss(PART_COLOR[id]) }} />
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums">{format(unit, valueOfPart(unit, report.totals.parts[id]))}</span>
            </li>
          ))}
        </ul>

        {report.memoryUnavailable && (
          <p className="text-xs text-muted-foreground">Memory usage could not be read from Hindsight: it is left out.</p>
        )}
      </CardContent>
    </Card>
  );
}
