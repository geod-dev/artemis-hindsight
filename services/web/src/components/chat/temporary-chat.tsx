"use client";

import { useAuiState } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { ChevronDownIcon, MessageCircleDashedIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  KEEPALIVE_INTERVAL_MS,
  TEMPORARY_CHAT_TITLE,
  TEMPORARY_MODE_LABELS,
  TEMPORARY_MODES,
  type TemporaryMode,
} from "@/lib/temporary-chat";

const MODE_DESCRIPTIONS: Record<TemporaryMode, string> = {
  personalized: "Uses your memory, workspace and skills",
  unpersonalized: "Knows nothing about you",
};

/**
 * The new chat's temporary switch, in the top bar's right corner. Once on, a menu beside it picks the mode. Turning it
 * off and on again keeps the mode picked last. It goes away with the first message: the mode is set for good then.
 */
export function TemporaryChatControls({
  value,
  onChange,
}: {
  value: TemporaryMode | null;
  onChange: (mode: TemporaryMode | null) => void;
}) {
  const [lastMode, setLastMode] = useState<TemporaryMode>(value ?? "personalized");
  const started = useAuiState((s) => s.thread.messages.length > 0);
  if (started) return null;

  const choose = (mode: TemporaryMode) => {
    setLastMode(mode);
    onChange(mode);
  };

  return (
    <div className="flex items-center gap-1">
      {value && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 rounded-full font-normal">
              {TEMPORARY_MODE_LABELS[value]}
              <ChevronDownIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 rounded-xl bg-popover/95 backdrop-blur">
            <DropdownMenuRadioGroup value={value} onValueChange={(mode) => choose(mode as TemporaryMode)}>
              {TEMPORARY_MODES.map((mode) => (
                <DropdownMenuRadioItem key={mode} value={mode} className="flex-col items-start gap-0.5">
                  <span>{TEMPORARY_MODE_LABELS[mode]}</span>
                  <span className="text-muted-foreground text-xs">{MODE_DESCRIPTIONS[mode]}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            size="sm"
            pressed={value !== null}
            onPressedChange={(on) => onChange(on ? lastMode : null)}
            aria-label={TEMPORARY_CHAT_TITLE}
            className="rounded-full"
          >
            <MessageCircleDashedIcon />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>{TEMPORARY_CHAT_TITLE}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** The top bar's title in a temporary chat, which is never named: "Temporary chat", and the mode when not personalized. */
export function TemporaryChatHeading({ mode }: { mode: TemporaryMode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <MessageCircleDashedIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
      <span className="truncate">{TEMPORARY_CHAT_TITLE}</span>
      {mode === "unpersonalized" && (
        <Badge variant="outline" className="text-muted-foreground rounded-full font-normal">
          {TEMPORARY_MODE_LABELS[mode]}
        </Badge>
      )}
    </span>
  );
}

/** Under the mascot of a new temporary chat, in place of the project picker: what a temporary chat is. */
export function TemporaryChatNotice({ mode }: { mode: TemporaryMode }) {
  return (
    <p className="text-muted-foreground max-w-sm text-center text-sm text-balance">
      Not saved to your history or memory, and deleted an hour after you leave it.
      {mode === "unpersonalized" && " Artemis knows nothing about you here."}
    </p>
  );
}

/**
 * Keeps a temporary chat alive while this page shows it: the server deletes a temporary chat nobody has kept alive for
 * an hour. It starts with the first message, which creates the chat on the server. Renders nothing.
 */
export function TemporaryChatKeepAlive({ conversationId }: { conversationId: string }) {
  const started = useAuiState((s) => s.thread.messages.length > 0);
  useEffect(() => {
    if (!started) return;
    const keepAlive = () => {
      void fetch(`/api/conversations/${conversationId}/keepalive`, { method: "POST" }).catch(() => undefined);
    };
    keepAlive();
    const timer = window.setInterval(keepAlive, KEEPALIVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [conversationId, started]);
  return null;
}
