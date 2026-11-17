import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, type LucideIcon } from "lucide-react-native";
import { usePreferences } from "@/preferences";

/**
 * The bottom sheet every menu of the app uses, in the Material 3 style: a surface with 28 dp top corners and a drag
 * handle, over a scrim that stays where it is while the sheet slides in. The title is centered; each option is a full
 * width row with the platform's own touch feedback.
 */
export function ActionSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const sheet = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.32} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.background, { backgroundColor: colors.surface }]}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 32 }}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        {title ? <Text style={[styles.title, { color: colors.muted }]}>{title}</Text> : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

/** One option of a sheet. `selected` shows a picker's current choice in the accent color; `checked` makes it a switch. */
export function ActionSheetOption({
  label,
  icon: Icon,
  onPress,
  destructive = false,
  selected = false,
  checked,
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
  checked?: boolean;
}) {
  const { colors } = usePreferences();
  const tint = destructive ? colors.danger : selected ? colors.accent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceStrong }}
      accessibilityRole={checked === undefined ? "button" : "checkbox"}
      accessibilityState={checked === undefined ? { selected } : { checked }}
      style={({ pressed }) => [
        styles.option,
        Platform.OS === "ios" && pressed && { backgroundColor: colors.surfaceStrong },
      ]}
    >
      {Icon ? <Icon size={20} color={tint} /> : null}
      <Text style={[styles.optionText, { color: tint }]}>{label}</Text>
      {checked !== undefined ? (
        <Check style={styles.check} size={18} color={checked ? colors.accent : "transparent"} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  content: { paddingHorizontal: 8, paddingTop: 4, gap: 2 },
  title: { fontSize: 14, fontWeight: "500", textAlign: "center", paddingVertical: 12 },
  option: { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 },
  optionText: { flexShrink: 1, fontSize: 16 },
  check: { position: "absolute", right: 16, alignSelf: "center" },
});
