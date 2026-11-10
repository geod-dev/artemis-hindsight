import { createContext } from "react";
import { mono } from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** The calendar day a message belongs to, as shown in the thread, e.g. "Nov 10". */
export function dayOf(date: Date): string {
  return dayFormat.format(date);
}

/**
 * Creation times of messages loaded from the database, by message id. Messages sent in this session
 * are not in the map and use the current time.
 */
export const MessageTimesContext = createContext<ReadonlyMap<string, Date>>(new Map());

/** A thin rule with the day in the middle, shown above the first message of each day. */
export function DayHeader({ day }: { day: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="bg-foreground/[0.08] h-px flex-1" />
      <span className={cn(mono, "text-muted-foreground")}>{day}</span>
      <span className="bg-foreground/[0.08] h-px flex-1" />
    </div>
  );
}
