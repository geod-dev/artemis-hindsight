import type { UsageBucket, UsageRange } from "@/lib/usage";
import { bucketGranularity, emptyTotals, rangeStart } from "@/lib/usage";

// The chart's bars. Days, months and years are the family's, in Paris time (as the memory jobs are); an hour is a whole
// hour in UTC too, because Paris is always a whole number of hours from UTC.

const PARIS = "Europe/Paris";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit" });
const hourLabel = new Intl.DateTimeFormat("en-GB", { timeZone: PARIS, hour: "2-digit", minute: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" });

/**
 * The bar a moment belongs to. Its key sorts in time order: an ISO hour (UTC) for the 24-hour chart, a Paris day
 * (YYYY-MM-DD), a month (YYYY-MM) or a year (YYYY).
 */
export function bucketKey(range: UsageRange, moment: Date): string {
  switch (bucketGranularity(range)) {
    case "hour":
      return new Date(Math.floor(moment.getTime() / HOUR_MS) * HOUR_MS).toISOString();
    case "day":
      return parisDay.format(moment);
    case "month":
      return parisDay.format(moment).slice(0, 7);
    case "year":
      return parisDay.format(moment).slice(0, 4);
  }
}

/**
 * Every bar of a range, oldest first, empty ones included, so the chart has no gaps. `earliest` is the first moment with
 * usage, which "all time" starts from. Returns no bars when there is nothing to show.
 */
export function emptyBuckets(range: UsageRange, now: Date, earliest: Date | null): UsageBucket[] {
  switch (bucketGranularity(range)) {
    case "hour": {
      const lastHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
      return Array.from({ length: 24 }, (_, index) => {
        const start = new Date(lastHour - (23 - index) * HOUR_MS);
        return bucket(start.toISOString(), hourLabel.format(start));
      });
    }

    case "day": {
      // This month: the 1st up to today.
      const from = rangeStart(range, now) ?? now;
      const buckets: UsageBucket[] = [];
      for (let key = parisDay.format(from); key <= parisDay.format(now); key = nextDay(key)) {
        buckets.push(bucket(key, dayLabel.format(new Date(`${key}T00:00:00Z`))));
      }
      return buckets;
    }

    case "month": {
      // This year: January up to the current month.
      const today = parisDay.format(now);
      const year = today.slice(0, 4);
      const currentMonth = Number(today.slice(5, 7));
      return Array.from({ length: currentMonth }, (_, index) => {
        const key = `${year}-${String(index + 1).padStart(2, "0")}`;
        return bucket(key, monthLabel.format(new Date(`${key}-01T00:00:00Z`)));
      });
    }

    case "year": {
      // All time: from the year of the first usage to the current year.
      if (!earliest) return [];
      const first = Number(parisDay.format(earliest).slice(0, 4));
      const last = Number(parisDay.format(now).slice(0, 4));
      return Array.from({ length: last - first + 1 }, (_, index) => {
        const key = String(first + index);
        return bucket(key, key);
      });
    }
  }
}

/** The day after a YYYY-MM-DD key. Plain calendar arithmetic in UTC, so no daylight-saving day is skipped or repeated. */
function nextDay(key: string): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

function bucket(key: string, label: string): UsageBucket {
  return { key, label, parts: emptyTotals().parts, turns: 0 };
}
