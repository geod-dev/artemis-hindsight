import { Host } from "@expo/ui";
import type { ComponentProps } from "react";
import { usePreferences } from "@/preferences";

/**
 * A Material 3 subtree that follows the app's own theme (Appearance: system, light or dark), not the phone's. Every
 * @expo/ui subtree sits in one. Sizing is the default: a screen's Host fills its parent; pass `matchContents` to fit.
 */
export function M3Host(props: Omit<ComponentProps<typeof Host>, "colorScheme">) {
  const { isDark } = usePreferences();
  return <Host colorScheme={isDark ? "dark" : "light"} {...props} />;
}
