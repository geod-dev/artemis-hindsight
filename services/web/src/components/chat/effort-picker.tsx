"use client";

import { useAui } from "@assistant-ui/react";
import { useEffect, useState, type FC } from "react";
import {
  ComposerMenu,
  ComposerModelItem,
  ComposerModelTrigger,
  type ComposerModel,
} from "@/components/assistant-ui/elements/composer";

export type ReasoningEffort = "low" | "medium" | "high";

const OPTIONS: { value: ReasoningEffort; entry: ComposerModel }[] = [
  { value: "low", entry: { name: "Low", meta: "Quick replies" } },
  { value: "medium", entry: { name: "Medium", meta: "Everyday tasks" } },
  { value: "high", entry: { name: "High", meta: "Complex works" } },
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
  const [open, setOpen] = useState(false);
  const selectedName = OPTIONS.find((option) => option.value === effort)?.entry.name ?? "Medium";

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

  return (
    <div className="relative">
      <ComposerModelTrigger
        model={selectedName}
        open={open}
        onClick={() => setOpen((v) => !v)}
        aria-label="Reasoning effort"
      />
      <ComposerMenu open={open} align="start">
        {OPTIONS.map((option) => (
          <ComposerModelItem
            key={option.value}
            entry={option.entry}
            selected={option.value === effort}
            onClick={() => {
              setEffort(option.value);
              setOpen(false);
              try {
                window.localStorage.setItem(STORAGE_KEY, option.value);
              } catch {
                // Not saved if storage is blocked; the choice still applies for this session.
              }
            }}
          />
        ))}
      </ComposerMenu>
    </div>
  );
};
