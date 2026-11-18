import { useEffect, useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import { usePreferences } from "@/preferences";
import { registerSidewaysScroll } from "@/lib/sideways-scroll";
import { useMessageLongPress } from "../message-long-press";

/** A bordered card for a visual. */
export function VisualCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = usePreferences();
  return <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }, style]}>{children}</View>;
}

/** Shown while a visual's block is still streaming, so the layout does not jump when it completes. */
export function VisualSkeleton({ label, height }: { label: string; height: number }) {
  const { colors } = usePreferences();
  return (
    <VisualCard style={{ height, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.muted} accessibilityLabel={label} />
    </VisualCard>
  );
}

/** A visual the agent wrote wrongly: say what is wrong and keep the reply readable. */
export function VisualError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  const { colors } = usePreferences();
  return (
    <VisualCard>
      <Text style={{ color: colors.text, fontWeight: "600" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button">
          <Text style={{ color: colors.accent, marginTop: 6 }}>Try again</Text>
        </Pressable>
      ) : null}
    </VisualCard>
  );
}

/**
 * A row of visuals that scrolls sideways inside a message. Its scroll is a gesture-handler scroll, registered so the drawer's
 * swipe waits for it (lib/sideways-scroll.ts). The row's children are ordinary presses: a tap or a long press on them is theirs.
 *
 * The content sits in a Pressable inside the scroll. Without it, a touch on plain content (the comparison cards' text, a code
 * block) makes the message's long-press Pressable, outside the scroll, the touch's JS responder. On Android the responder's
 * view then intercepts the moves (JSResponderHandler), so the scroll inside it never sees the swipe. Image tiles did not hit
 * this because each one is a Pressable inside the scroll. A long press on the row still opens the message's options.
 */
export function HorizontalRow({ children, gap = 0, contentStyle }: { children: ReactNode; gap?: number; contentStyle?: ViewStyle }) {
  const scroll = useMemo(() => Gesture.Native(), []);
  useEffect(() => registerSidewaysScroll(scroll), [scroll]);
  const openMessageOptions = useMessageLongPress();

  return (
    <GestureDetector gesture={scroll}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Pressable
          onLongPress={openMessageOptions}
          delayLongPress={400}
          style={[styles.rowContent, gap ? { gap } : undefined, contentStyle]}
        >
          {children}
        </Pressable>
      </ScrollView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 6 },
  // A horizontal ScrollView lays its content out in a row; the Pressable that now holds it keeps that layout.
  rowContent: { flexDirection: "row" },
});
