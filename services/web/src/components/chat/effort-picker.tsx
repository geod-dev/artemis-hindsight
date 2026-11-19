"use client";

import { useAui } from "@assistant-ui/react";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState, type FC } from "react";
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

function isEffort(value: unknown): value is ReasoningEffort {
  return value === "low" || value === "medium" || value === "high";
}

/**
 * Reasoning effort for the next message. The choice is registered in the model context, so the transport sends it
 * with every message until it changes.
 */
export const EffortPicker: FC = () => {
  const aui = useAui();
  const [effort, setEffort] = useState<ReasoningEffort>(DEFAULT_REASONING_EFFORT);
  const selectedName = OPTIONS.find((option) => option.value === effort)?.name ?? "Medium";

  // Read after mount, not during render, so the server and the first browser render match.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isEffort(saved)) setEffort(saved);
    } catch {
      // Storage can be blocked (private mode, disabled site data): the default stays.
    }
  }, []);

  useEffect(
    () =>
      aui.modelContext.register({
        getModelContext: () => ({ config: { reasoningEffort: effort } }),
      }),
    [aui, effort],
  );

  const choose = (value: string) => {
    if (!isEffort(value)) return;
    setEffort(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Not saved if storage is blocked; the choice still applies for this session.
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="pill" size="xs" aria-label="Reasoning effort">
          {selectedName}
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={effort} onValueChange={choose}>
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
