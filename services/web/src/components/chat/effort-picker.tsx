"use client";

import { useAui } from "@assistant-ui/react";
import { ChevronDownIcon } from "lucide-react";
import { createContext, useEffect, useState, type FC, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ReasoningEffort = "low" | "medium" | "high";

const OPTIONS: { value: ReasoningEffort; name: string; meta: string }[] = [
  { value: "low", name: "Low", meta: "Quick replies" },
  { value: "medium", name: "Medium", meta: "Everyday tasks" },
  { value: "high", name: "High", meta: "Complex works" },
];

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";

// The last choice is remembered per browser, so a new message starts with the same effort.
const STORAGE_KEY = "artemis.reasoningEffort";

export function isEffort(value: unknown): value is ReasoningEffort {
  return value === "low" || value === "medium" || value === "high";
}

/** The browser's last choice, or the default. */
export function savedEffort(): ReasoningEffort {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isEffort(saved)) return saved;
  } catch {
    // Storage can be blocked (private mode, disabled site data): the default stays.
  }
  return DEFAULT_REASONING_EFFORT;
}

/**
 * The effort an edit is sent with. The edit card sets it right before sending, and the transport reads it once, in place
 * of the composer's effort: the edit card has its own choice, which must not change the composer's.
 */
export const EditEffortContext = createContext<RefObject<ReasoningEffort | null> | null>(null);

/** The effort menu: a pill showing the choice, and the three options. */
export const EffortMenu: FC<{ value: ReasoningEffort; onChange: (value: ReasoningEffort) => void }> = ({
  value,
  onChange,
}) => {
  const selectedName = OPTIONS.find((option) => option.value === value)?.name ?? "Medium";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="pill" size="xs" aria-label="Reasoning effort">
          {selectedName}
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => isEffort(next) && onChange(next)}>
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span className="flex-1">{option.name}</span>
              <span className="text-muted-foreground text-xs">{option.meta}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Reasoning effort for the next message. The choice is registered in the model context, so the transport sends it
 * with every message until it changes.
 */
export const EffortPicker: FC = () => {
  const aui = useAui();
  const [effort, setEffort] = useState<ReasoningEffort>(DEFAULT_REASONING_EFFORT);

  // Read after mount, not during render, so the server and the first browser render match.
  useEffect(() => setEffort(savedEffort()), []);

  useEffect(
    () =>
      aui.modelContext.register({
        getModelContext: () => ({ config: { reasoningEffort: effort } }),
      }),
    [aui, effort],
  );

  const choose = (value: ReasoningEffort) => {
    setEffort(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Not saved if storage is blocked; the choice still applies for this session.
    }
  };

  return <EffortMenu value={effort} onChange={choose} />;
};
