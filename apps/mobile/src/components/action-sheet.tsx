import { BottomSheet, Column, ListItem, RNHostView, Switch, Text } from "@expo/ui";
import type { ReactNode } from "react";
import { usePreferences } from "@/preferences";
import { Glyph, type GlyphName } from "./glyph";

/**
 * The bottom sheet every menu of the app uses: Material 3's modal sheet (@expo/ui), with the default drag handle and
 * scrim. Its content is universal @expo/ui components: ActionSheetOption rows, and an optional title.
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
  return (
    <BottomSheet isPresented={visible} onDismiss={onClose} containerColor={colors.surface}>
      <Column>
        {title ? <Text textStyle={{ color: colors.muted }}>{title}</Text> : null}
        {children}
      </Column>
    </BottomSheet>
  );
}

/**
 * One option of a sheet: a list row. `icon` is a glyph from the registry, or a React Native node (a project's picture)
 * shown through RNHostView. `selected` shows a picker's current choice with a check; `checked` makes the option a
 * switch row (its value is shown by the trailing switch). Destructive options take the danger colour.
 */
export function ActionSheetOption({
  label,
  icon,
  onPress,
  destructive = false,
  selected = false,
  checked,
}: {
  label: string;
  icon?: GlyphName | ReactNode;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
  checked?: boolean;
}) {
  const { colors } = usePreferences();
  const leading =
    typeof icon === "string" ? (
      <Glyph name={icon as GlyphName} color={destructive ? colors.danger : undefined} />
    ) : icon ? (
      <RNHostView matchContents>
        <>{icon}</>
      </RNHostView>
    ) : null;
  return (
    <ListItem onPress={onPress}>
      <Text textStyle={destructive ? { color: colors.danger } : undefined}>{label}</Text>
      {leading ? <ListItem.Leading>{leading}</ListItem.Leading> : null}
      {checked !== undefined ? (
        <ListItem.Trailing>
          <Switch value={checked} onValueChange={onPress} />
        </ListItem.Trailing>
      ) : selected ? (
        <ListItem.Trailing>
          <Glyph name="check" color={colors.accent} />
        </ListItem.Trailing>
      ) : null}
    </ListItem>
  );
}
