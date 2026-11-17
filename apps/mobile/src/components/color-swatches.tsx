import { Button, Row } from "@expo/ui";
import { AVATAR_COLOR_IDS, AVATAR_COLORS, type AvatarColorId } from "@/lib/avatar";
import { usePreferences } from "@/preferences";
import { M3Host } from "./m3";

/**
 * The palette of the avatar colors as a row of swatches: the profile's avatar color and a project's color. The same
 * palette as the web's ColorSwatches (services/web/src/components/profile/color-swatches.tsx). Material 3 has no colour
 * swatch, so each swatch is a round @expo/ui Button filled with its colour; the selected one gets a ring.
 */
export function ColorSwatches({
  value,
  onChange,
  disabled = false,
}: {
  value: AvatarColorId | null;
  onChange: (color: AvatarColorId) => void;
  disabled?: boolean;
}) {
  const { colors } = usePreferences();
  return (
    <M3Host matchContents>
      <Row>
        {AVATAR_COLOR_IDS.map((id) => {
          const selected = value === id;
          return (
            <Button
              key={id}
              disabled={disabled}
              onPress={() => onChange(id)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: AVATAR_COLORS[id],
                borderWidth: selected ? 3 : 0,
                borderColor: colors.text,
              }}
            />
          );
        })}
      </Row>
    </M3Host>
  );
}
