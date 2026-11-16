import { useRouter, type Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable } from "react-native";
import { usePreferences } from "@/preferences";

/**
 * The back arrow in a drawer header: replaces the menu button on a settings screen. With `to`, it goes to that screen
 * (the settings subpages go to the settings main page). Without it, it goes back in the history, or to a new chat.
 * The drawer's history is not a stack: back from a subpage would land on the first drawer screen, not on settings.
 */
export function BackButton({ to }: { to?: Href }) {
  const router = useRouter();
  const { colors } = usePreferences();
  const goBack = () => {
    if (to) return router.navigate(to);
    if (router.canGoBack()) return router.back();
    return router.replace("/new");
  };
  return (
    <Pressable
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      style={{ marginLeft: 8, marginRight: 4, padding: 4 }}
    >
      <ChevronLeft size={24} color={colors.text} />
    </Pressable>
  );
}
