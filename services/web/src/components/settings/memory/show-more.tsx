"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Renders the first `initial` items, with a button for the rest. */
export function ShowMore<T>({
  items,
  initial,
  render,
}: {
  items: readonly T[];
  initial: number;
  render: (shown: readonly T[]) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const hidden = items.length - initial;
  return (
    <div className="flex flex-col gap-1">
      {render(all || hidden <= 0 ? items : items.slice(0, initial))}
      {hidden > 0 && (
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setAll((value) => !value)}>
          {all ? "Show less" : `Show ${hidden} more`}
        </Button>
      )}
    </div>
  );
}
