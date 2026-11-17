import { ActivityIndicator, View, type ViewStyle } from "react-native";
import { Button, Column, Text } from "@expo/ui";
import { usePreferences } from "@/preferences";
import { M3Host } from "@/components/m3";

/** The container of a visual: the screen's surface colour, no outline and no padding of its own. */
export function VisualCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = usePreferences();
  return <View style={[{ backgroundColor: colors.surface }, style]}>{children}</View>;
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
      <M3Host matchContents={{ vertical: true }}>
        <Column>
          <Text>{title}</Text>
          <Text textStyle={{ color: colors.muted }}>{message}</Text>
          {onRetry ? <Button variant="text" label="Try again" onPress={onRetry} /> : null}
        </Column>
      </M3Host>
    </VisualCard>
  );
}
