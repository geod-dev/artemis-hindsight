"use client";

import { Check } from "lucide-react";
import { AVATAR_COLORS, type AvatarColorId } from "@/lib/avatar-colors";
import { cn } from "@/lib/utils";

export function ColorSwatches({
  value,
  onChange,
  disabled,
}: {
  value: AvatarColorId | null;
  onChange: (color: AvatarColorId) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Avatar color" className="grid grid-cols-8 gap-2">
      {AVATAR_COLORS.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
            style={{ backgroundColor: `var(--avatar-${color})` }}
          >
            {selected && <Check className="size-4 text-white" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
