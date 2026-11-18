import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, Eye } from "lucide-react-native";
import { absoluteUrl, authHeaders } from "@/lib/api";
import { extensionLabel, mediaTypeOf, baseName, sandboxFileUrl } from "@/lib/sandbox-files";
import { FILE_CARD, fileKind } from "@/lib/file-icons";
import { usePreferences } from "@/preferences";
import { downloadToCache } from "./file-part";
import * as Sharing from "expo-sharing";

/**
 * A file the agent produced, as a card (the web app's FileCard): a thumbnail for an image or the type's tile, the name,
 * the type, and an action icon. A tap downloads the file with the session and opens the share sheet.
 * Drawn from the sandbox path the agent wrote in its link.
 */
export function SandboxFileCard({ conversationId, path }: { conversationId: string; path: string }) {
  const { colors } = usePreferences();
  const [busy, setBusy] = useState(false);
  const name = baseName(path);
  const mediaType = mediaTypeOf(name);
  const isImage = mediaType.startsWith("image/");
  const { Icon, tint } = fileKind(name, mediaType);
  const url = sandboxFileUrl(conversationId, path);
  const type = extensionLabel(name) || "File";

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const file = await downloadToCache(url, name);
      await Sharing.shareAsync(file.uri);
    } catch {
      Alert.alert("File unavailable", "Could not fetch this file right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={() => void open()}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {isImage ? (
        <Image source={{ uri: absoluteUrl(url), headers: authHeaders() }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.tile, { backgroundColor: tint ? `${tint}26` : colors.surfaceStrong }]}>
          <Icon size={18} color={tint ?? colors.muted} />
        </View>
      )}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>
          {type}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : isImage ? (
        <Eye size={16} color={colors.muted} />
      ) : (
        <Download size={16} color={colors.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: FILE_CARD.gap,
    maxWidth: 288,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: FILE_CARD.radius,
    paddingVertical: FILE_CARD.padding,
    paddingLeft: FILE_CARD.padding,
    paddingRight: FILE_CARD.paddingRight,
    marginVertical: 4,
  },
  thumb: { width: FILE_CARD.tile, height: FILE_CARD.tile, borderRadius: FILE_CARD.tileRadius },
  tile: {
    width: FILE_CARD.tile,
    height: FILE_CARD.tile,
    borderRadius: FILE_CARD.tileRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flexShrink: 1, gap: 2 },
  name: { fontSize: 13, fontWeight: "500" },
  meta: { fontSize: 11 },
});
