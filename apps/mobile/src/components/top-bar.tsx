import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Menu } from "lucide-react-native";
import { usePreferences, type Palette } from "@/preferences";

// The one top bar of the app: the chat, the new chat, the projects and the settings with their subpages all draw their
// header with TopBar (as the `header` option of their screen), so they share its height, its safe-area inset and its title.

/** The header's size, below the status bar. */
const BAR_HEIGHT = 56;
/** The width of the left and right slots, so the title starts at the same place with or without a button. */
const SLOT_WIDTH = 48;

/** The part of a screen's options the header reads: the names are React Navigation's header options. */
export interface TopBarProps {
  options: {
    title?: string;
    headerTitle?: string | ((props: { children: string; tintColor?: string }) => ReactNode);
    headerLeft?: (props: { canGoBack?: boolean; tintColor?: string }) => ReactNode;
    headerRight?: (props: { tintColor?: string }) => ReactNode;
    headerTitleStyle?: TextStyle;
  };
  route: { name: string };
  navigation: { goBack?: () => void; toggleDrawer?: () => void };
  /** Set when the screen can go back (a stack screen that is not the first one). */
  back?: { title?: string };
}

/** The options every screen shares: a flat header in the background colour, the title left-aligned at 22 pt medium. */
export function topBarOptions(colors: Palette) {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTitleAlign: "left" as const,
    headerTitleStyle: { fontSize: 22, fontWeight: "500" as const },
    headerTintColor: colors.text,
  };
}

/**
 * The `header` option of every screen. Expo Router's own header types are looser than TopBarProps: the screens pass the
 * same fields, so the one cast is here, not at each screen.
 */
export function renderTopBar(props: unknown): ReactNode {
  return <TopBar {...(props as TopBarProps)} />;
}

/**
 * The header. Its left side is the screen's `headerLeft` if it has one, else a back arrow on a stack screen, else the
 * drawer's menu button. Its title is the screen's `headerTitle` (a custom title, such as the conversation's name with its
 * project badge) if it has one, else the screen's title.
 */
export function TopBar({ options, route, navigation, back }: TopBarProps) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const tint = colors.text;

  const label = options.title ?? route.name;
  const title =
    typeof options.headerTitle === "function" ? (
      options.headerTitle({ children: label, tintColor: tint })
    ) : (
      <Text numberOfLines={1} style={[styles.title, { color: tint }, options.headerTitleStyle]}>
        {options.headerTitle ?? label}
      </Text>
    );

  let left: ReactNode = null;
  if (options.headerLeft) {
    left = options.headerLeft({ canGoBack: Boolean(back), tintColor: tint });
  } else if (back && navigation.goBack) {
    left = <BarButton label="Back" onPress={() => navigation.goBack?.()}><ChevronLeft size={24} color={tint} /></BarButton>;
  } else if (navigation.toggleDrawer) {
    left = <BarButton label="Menu" onPress={() => navigation.toggleDrawer?.()}><Menu size={24} color={tint} /></BarButton>;
  }
  const right = options.headerRight ? options.headerRight({ tintColor: tint }) : null;

  return (
    <View style={[styles.bar, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={[styles.slot, styles.leftSlot]}>{left}</View>
        <View style={styles.center}>{title}</View>
        <View style={[styles.slot, styles.rightSlot]}>{right}</View>
      </View>
    </View>
  );
}

function BarButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={styles.button}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {},
  row: { flexDirection: "row", alignItems: "center", minHeight: BAR_HEIGHT },
  slot: { width: SLOT_WIDTH, height: BAR_HEIGHT, justifyContent: "center" },
  leftSlot: { alignItems: "flex-start" },
  rightSlot: { alignItems: "flex-end" },
  center: { flex: 1, minWidth: 0, justifyContent: "center" },
  button: { width: SLOT_WIDTH, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "500" },
});
