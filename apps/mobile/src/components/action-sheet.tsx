import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Check, type LucideIcon } from "lucide-react-native";
import { usePreferences } from "@/preferences";

const OPEN_MS = 260;
const CLOSE_MS = 200;
// Before the sheet is measured: far enough below the screen that it starts hidden.
const HIDDEN_OFFSET = 480;

/**
 * The bottom sheet of options, opened by a long press: the message menu and the conversation menu share it. Tap outside
 * (or the Android back button) to close it. The options are passed as children.
 *
 * The sheet slides up from the bottom by its own height; the backdrop only fades in and out, without moving. The Modal's
 * own animation is off, because it would move the backdrop too.
 */
export function ActionSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { colors } = usePreferences();
  // The Modal stays mounted while the sheet slides away, then unmounts.
  const [mounted, setMounted] = useState(visible);
  // 0 = closed, 1 = open. The backdrop's opacity is this value; the sheet moves by (1 - value) of its height.
  const progress = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      return undefined;
    }
    Animated.timing(progress, { toValue: 0, duration: CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMounted(false);
      },
    );
    return undefined;
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight || HIDDEN_OFFSET, 0],
  });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          onLayout={(event: LayoutChangeEvent) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY }] }]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * A tappable option of an action sheet: the same row as the message menu's options. Every option has an icon on its left.
 * `selected` marks the current choice of a picker (the new chat's project), with an accent label.
 */
export function ActionSheetOption({
  label,
  icon: Icon,
  onPress,
  destructive = false,
  selected = false,
  checked,
  color,
}: {
  label: string;
  /** The option's icon (a lucide icon), shown on the left of the label. */
  icon: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
  /** A switch-like option: undefined for a plain action, true or false for an option that is on or off. */
  checked?: boolean;
  /** The icon's colour when it is not the text colour (a project's folder takes the project's colour). */
  color?: string;
}) {
  const { colors } = usePreferences();
  const tone = destructive ? colors.danger : selected ? colors.accent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={checked === undefined ? "button" : "checkbox"}
      accessibilityState={checked === undefined ? { selected } : { checked }}
      // Android: the Material ripple from the touch point. iOS has no ripple: the row fades while it is pressed.
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [styles.option, styles.optionRow, Platform.OS === "ios" && pressed && styles.pressed]}
    >
      <View style={styles.optionLead}>
        <Icon size={18} color={color ?? tone} />
        <Text style={[styles.optionText, { color: tone }]}>{label}</Text>
      </View>
      {checked !== undefined ? <Check size={18} color={checked ? colors.accent : "transparent"} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.35)" },
  // The rows reach the sheet's edges (no side padding here): each row insets its own text.
  sheet: { width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, paddingTop: 10, gap: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  // A transparent row across the full width of the sheet: no border, the sheet's own surface behind it.
  option: { width: "100%", alignSelf: "stretch", paddingVertical: 14, paddingHorizontal: 24 },
  pressed: { opacity: 0.6 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionLead: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  optionText: { fontSize: 16 },
});
