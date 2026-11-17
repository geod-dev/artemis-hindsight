import { Image, Linking, Pressable, Text, View } from "react-native";
import { usePreferences } from "@/preferences";
import { domainOf } from "../source-links";

/** A cited source: a small pill with the site's icon and the link text, opening the page on tap. */
export function SourceBadge({ url, label }: { url: string; label: string }) {
  const { colors } = usePreferences();
  const domain = domainOf(url);
  // A link inside a sentence of the reply: it stays React Native text (the markdown around it is React Native too).
  return (
    <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" accessibilityLabel={`Source: ${label}`}>
      <View>
        <Image source={{ uri: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico` }} style={{ width: 14, height: 14 }} />
      </View>
      <Text numberOfLines={1} style={{ color: colors.muted }}>
        {label || domain}
      </Text>
    </Pressable>
  );
}
