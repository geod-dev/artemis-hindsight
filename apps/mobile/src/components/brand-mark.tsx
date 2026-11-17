import { Image } from "react-native";
import { usePreferences } from "@/preferences";

// The web favicon, in its two variants: the light one (blue body) and the dark one (white body, for dark screens).
const LIGHT = require("../../assets/images/splash-icon.png");
const DARK = require("../../assets/images/splash-icon-dark.png");
// The same mascot with its eyes cut out (transparent), so a tint colors the body and the eyes show the background, as
// on the web. Made from splash-icon.png: its white eyes are set to transparent.
const BODY = require("../../assets/images/mascot-body.png");

/**
 * The Artemis mascot, from the web favicon. Shown on the loading screen, the sign-in screen and the empty chat instead of
 * text. With `tint` (a project's color, as a hex value) the body takes that color and the eyes show through.
 */
export function BrandMark({ size = 120, tint }: { size?: number; tint?: string }) {
  const { isDark } = usePreferences();
  if (tint) {
    return (
      <Image
        source={BODY}
        style={{ width: size, height: size, tintColor: tint }}
        accessibilityLabel="Artemis"
        resizeMode="contain"
      />
    );
  }
  return (
    <Image
      source={isDark ? DARK : LIGHT}
      style={{ width: size, height: size }}
      accessibilityLabel="Artemis"
      resizeMode="contain"
    />
  );
}
