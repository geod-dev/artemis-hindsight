import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/preferences";

/**
 * The bottom sheet of options, opened by a long press: the message menu and the conversation menu share it. Tap outside
 * (or the Android back button) to close it. The options are passed as children.
 */
export function ActionSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { colors } = usePreferences();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** A tappable option of an action sheet: the same row as the message menu's options. */
export function ActionSheetOption({ label, onPress, destructive = false }: { label: string; onPress: () => void; destructive?: boolean }) {
  const { colors } = usePreferences();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.option, { borderColor: colors.border }]}>
      <Text style={[styles.optionText, { color: destructive ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 10, gap: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  option: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 16 },
});
