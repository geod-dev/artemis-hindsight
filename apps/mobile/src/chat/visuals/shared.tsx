import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { usePreferences } from "@/preferences";

/** A bordered card for a visual. */
export function VisualCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
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

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 6 },
});
