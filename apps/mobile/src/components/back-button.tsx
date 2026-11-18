import { useRouter, type Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable } from "react-native";
import { usePreferences } from "@/preferences";
import { getReturnTo } from "@/lib/return-to";

/**
 * The back arrow in a drawer header: replaces the menu button on a settings screen. With `to`, it goes to that screen
 * (the settings subpages go to the settings main page). Without it, it goes back to the page the settings were opened
 * from. The drawer's history is not a stack, so that page is remembered when the settings open.
 */
export function BackButton({ to }: { to?: Href }) {
  const router = useRouter();
  const { colors } = usePreferences();
  const goBack = () => router.navigate(to ?? getReturnTo());
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
