"use client";

import { BranchPickerPrimitive } from "@assistant-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { FC } from "react";
import { ghostButton } from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";

/**
 * "‹ 2/3 ›" under a message that has siblings: an edited message, or a regenerated reply. Hidden when the message has
 * only one version. Switching is disabled while a reply runs (the runtime ignores it then).
 * The phone has the same control in apps/mobile/src/chat/branch-picker.tsx.
 */
export const BranchPicker: FC<{ className?: string }> = ({ className }) => (
  <BranchPickerPrimitive.Root
    hideWhenSingleBranch
    className={cn("text-muted-foreground inline-flex items-center text-xs tabular-nums", className)}
  >
    <BranchPickerPrimitive.Previous asChild>
      <button type="button" aria-label="Previous version" className={cn(ghostButton, "size-7 disabled:opacity-40")}>
        <ChevronLeftIcon className="size-3.5" />
      </button>
    </BranchPickerPrimitive.Previous>
    <span className="min-w-8 text-center">
      <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <button type="button" aria-label="Next version" className={cn(ghostButton, "size-7 disabled:opacity-40")}>
        <ChevronRightIcon className="size-3.5" />
      </button>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);
