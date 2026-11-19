import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design system's radius tokens (globals.css: --radius-surface, --radius-control). tailwind-merge must know them
// as radii, or `rounded-control rounded-full` keeps both classes and the CSS order picks the winner.
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ["surface", "control"] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
