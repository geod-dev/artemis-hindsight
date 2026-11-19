import { useState } from "react";
import { Image, Pressable, Text, View, type ImageSourcePropType } from "react-native";
import { ImageOff } from "lucide-react-native";
import { usePreferences } from "@/preferences";

// The tile shared by the image group and the product group, in their sideways-scrolling row: a picture, and for a
// product its name under it. The same tile as the web's row (services/web/src/components/chat/image-row.tsx).

/** The width of a tile in a row. */
export const TILE_WIDTH = 150;

export function ImageTile({
  source,
  height,
  fit = "cover",
  caption,
  label,
  onPress,
}: {
  source: ImageSourcePropType;
  height: number;
  /** cover fills the tile (photos); contain shows the whole picture on white (product photos). */
  fit?: "cover" | "contain";
  /** The text under the picture, for a product its name. */
  caption?: string;
  label: string;
  /** A tap, or a long press, on the tile. */
  onPress: () => void;
}) {
  const { colors } = usePreferences();
  const [failed, setFailed] = useState(false);
  const tile = {
    width: TILE_WIDTH,
    height,
    borderRadius: 12,
    backgroundColor: fit === "contain" && !failed ? "#ffffff" : colors.surface,
  };

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onPress}
      style={{ width: TILE_WIDTH, gap: 6 }}
    >
      {failed ? (
        <View style={[tile, { alignItems: "center", justifyContent: "center" }]}>
          <ImageOff size={22} color={colors.muted} />
        </View>
      ) : (
        <Image source={source} style={tile} resizeMode={fit} onError={() => setFailed(true)} />
      )}
      {caption ? (
        <Text numberOfLines={2} style={{ color: colors.text, fontSize: 12, fontWeight: "500" }}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}
