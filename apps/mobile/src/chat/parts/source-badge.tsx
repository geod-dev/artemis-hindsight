import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/preferences";
import { domainOf } from "../source-links";

/** A cited source: a small pill with the site's icon and the link text, opening the page on tap. */
export function SourceBadge({ url, label }: { url: string; label: string }) {
  const { colors } = usePreferences();
  const domain = domainOf(url);
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Source: ${label}`}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "center",
          marginHorizontal: 2,
          paddingLeft: 4,
          paddingRight: 8,
          paddingVertical: 2,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.6 : 1,
          maxWidth: 220,
        },
      ]}
    >
      <View style={{ width: 14, height: 14, borderRadius: 3, overflow: "hidden", backgroundColor: colors.surfaceStrong }}>
        <Image source={{ uri: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico` }} style={{ width: 14, height: 14 }} />
      </View>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
        {label || domain}
      </Text>
    </Pressable>
  );
}
