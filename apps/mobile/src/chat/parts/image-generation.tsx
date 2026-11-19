import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { usePreferences } from "@/preferences";

// The frame shown while an image is being generated. assistant-ui's ImageGeneration element is web-only (there is no
// React Native registry item, and @assistant-ui/react-native has no such component), so this reproduces its generating
// state: services/web/src/components/assistant-ui/elements/image-generation.tsx. Same 8 x 8 dot grid pulsing in a
// diagonal wave (Tailwind's animate-pulse, each dot 90 ms after its neighbour), same size, radius and surface, and the
// "Generating" label under it, which breathes with the wave (the web's label shimmers).

const GRID = 8;
const DOTS = Array.from({ length: GRID * GRID }, (_, i) => i);
/** Tailwind's animate-pulse: 2 s per cycle. */
const PULSE_MS = 2000;
/** The delay between two neighbouring dots, as on the web. */
const WAVE_STEP_MS = 90;
/** The web element's width (w-52). */
const SIZE = 208;

export function ImageGenerationFrame() {
  const { colors } = usePreferences();
  const reduceMotion = useReducedMotion();
  // One clock for every dot: each reads it with its own delay, so the 64 dots cost one animation.
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    clock.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.linear }), -1, false);
  }, [clock, reduceMotion]);
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.6 + 0.4 * Math.cos(2 * Math.PI * clock.value) }));

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel="Generating image">
      <View style={[styles.frame, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.grid}>
          {DOTS.map((dot) => (
            <Dot
              key={dot}
              clock={clock}
              delayMs={(Math.floor(dot / GRID) + (dot % GRID)) * WAVE_STEP_MS}
              color={`${colors.text}33`}
            />
          ))}
        </View>
      </View>
      <Animated.Text style={[styles.label, { color: colors.muted }, labelStyle]}>Generating</Animated.Text>
    </View>
  );
}

/** One dot: full opacity, down to half mid-cycle, back up (animate-pulse), shifted by its place in the wave. */
function Dot({ clock, delayMs, color }: { clock: SharedValue<number>; delayMs: number; color: string }) {
  const phase = delayMs / PULSE_MS;
  const style = useAnimatedStyle(() => {
    const t = (clock.value - phase + 1) % 1;
    return { opacity: 0.75 + 0.25 * Math.cos(2 * Math.PI * t) };
  });
  return (
    <View style={styles.cell}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SIZE, gap: 10, marginVertical: 8 },
  // rounded-2xl and the paper surface of the web element.
  frame: { width: SIZE, height: SIZE, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", padding: 24 },
  grid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / GRID}%`, height: `${100 / GRID}%`, alignItems: "center", justifyContent: "center" },
  dot: { width: 4, height: 4, borderRadius: 2 },
  label: { fontSize: 12 },
});
