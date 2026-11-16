import { Image } from "react-native";
import { usePreferences } from "@/preferences";

// The web favicon, in its two variants: the light one (blue body) and the dark one (white body, for dark screens).
const LIGHT = require("../../assets/images/splash-icon.png");
const DARK = require("../../assets/images/splash-icon-dark.png");

/** The Artemis mascot, from the web favicon. Shown on the loading screen and the sign-in screen instead of text. */
export function BrandMark({ size = 120 }: { size?: number }) {
  const { isDark } = usePreferences();
  return (
    <Image
      source={isDark ? DARK : LIGHT}
      style={{ width: size, height: size }}
      accessibilityLabel="Artemis"
      resizeMode="contain"
    />
  );
}
