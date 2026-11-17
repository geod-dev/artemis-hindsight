import { Button } from "@expo/ui";
import { useRouter, type Href } from "expo-router";
import { Glyph } from "./glyph";
import { M3Host } from "./m3";
import { getReturnTo } from "@/lib/return-to";

/**
 * The back arrow in a drawer header: replaces the menu button on a settings screen. With `to`, it goes to that screen
 * (the settings subpages go to the settings main page). Without it, it goes back to the page the settings were opened
 * from. The drawer's history is not a stack, so that page is remembered when the settings open.
 */
export function BackButton({ to }: { to?: Href }) {
  const router = useRouter();
  const goBack = () => router.navigate(to ?? getReturnTo());
  return (
    <M3Host matchContents>
      <Button variant="text" onPress={goBack}>
        <Glyph name="chevronLeft" />
      </Button>
    </M3Host>
  );
}
