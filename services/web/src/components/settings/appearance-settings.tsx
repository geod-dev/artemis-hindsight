"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ThemeChoice = "system" | "light" | "dark";

const CHOICES: { value: ThemeChoice; label: string; description: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", description: "Follows your device", icon: Monitor },
  { value: "light", label: "Light", description: "Always light", icon: Sun },
  { value: "dark", label: "Dark", description: "Always dark", icon: Moon },
];

/** A tiny chat. The wrapper's class picks the tokens, so the preview shows its theme inside any page. */
function ChatPreview({ tone }: { tone: "light" | "dark" }) {
  return (
    <div className={cn(tone, "flex h-full w-full flex-col justify-between gap-2 bg-background p-3 text-foreground")}>
      <div className="flex flex-col gap-1.5">
        <div className="ml-auto h-3 w-2/3 rounded-full bg-primary" />
        <div className="h-3 w-1/2 rounded-full border border-border bg-muted" />
        <div className="ml-auto h-3 w-1/3 rounded-full bg-primary" />
        <div className="h-3 w-2/5 rounded-full border border-border bg-muted" />
      </div>
      <div className="h-5 w-full rounded-full border border-border bg-muted" />
    </div>
  );
}

function Preview({ choice }: { choice: ThemeChoice }) {
  if (choice === "system") {
    return (
      <div className="grid h-full w-full grid-cols-2">
        <ChatPreview tone="light" />
        <ChatPreview tone="dark" />
      </div>
    );
  }
  return <ChatPreview tone={choice} />;
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? ((theme as ThemeChoice | undefined) ?? "system") : undefined;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="text-sm text-muted-foreground">Choose how Artemis looks on this device.</p>
      </header>

      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CHOICES.map(({ value, label, description, icon: Icon }) => {
          const selected = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                "group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left transition-all duration-150 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && "border-foreground ring-1 ring-foreground",
              )}
            >
              <div className="aspect-[4/3] w-full border-b">
                <Preview choice={value} />
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Icon className="size-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border transition-colors",
                    selected ? "border-foreground bg-foreground text-background" : "border-muted-foreground/40",
                  )}
                >
                  {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
