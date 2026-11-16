import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { absoluteUrl, authHeaders } from "@/lib/api";
import { FILE_CARD, fileKind } from "@/lib/file-icons";
import { baseName, extensionLabel, sandboxFileUrl } from "@/lib/sandbox-files";
import { usePreferences } from "@/preferences";

/**
 * Downloads a file from the server into the cache with the session, then opens the system share sheet (save, open
 * in another app). The server is the only holder of the bytes: the app never keeps a copy beyond the cache.
 */
export async function downloadToCache(url: string, filename: string): Promise<File> {
  const destination = new Directory(Paths.cache, "artemis");
  if (!destination.exists) destination.create({ intermediates: true });
  const target = new File(destination, filename);
  if (target.exists) target.delete();
  return File.downloadFileAsync(absoluteUrl(url), target, { headers: authHeaders() });
}

export async function openSandboxFile(conversationId: string, path: string): Promise<void> {
  try {
    const file = await downloadToCache(sandboxFileUrl(conversationId, path), baseName(path));
    await Sharing.shareAsync(file.uri);
  } catch {
    Alert.alert("File unavailable", "Could not fetch this file right now.");
  }
}

/** An image in a message: the uploaded picture, or an image the agent produced. Loaded with the session. */
export function ImagePart({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const { colors } = usePreferences();
  if (failed) return <Text style={{ color: colors.muted }}>Image unavailable</Text>;
  return (
    <Image
      source={{ uri: absoluteUrl(url), headers: authHeaders() }}
      onError={() => setFailed(true)}
      resizeMode="contain"
      style={styles.image}
      accessibilityLabel="Image"
    />
  );
}

/** A file in a message: its name, opened through the share sheet. */
export function FilePart({ url, filename, mimeType }: { url: string; filename?: string; mimeType?: string }) {
  const { colors } = usePreferences();
  const [busy, setBusy] = useState(false);
  const name = filename ?? baseName(url);
  const { Icon, tint } = fileKind(name, mimeType);

  const open = async () => {
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
      style={[styles.file, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <View style={[styles.fileIcon, { backgroundColor: tint ? `${tint}26` : colors.surfaceStrong }]}>
        <Icon size={18} color={tint ?? colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>
          {name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{extensionLabel(name) || "File"}</Text>
      </View>
      {busy ? <ActivityIndicator color={colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: 12 },
  fileIcon: {
    width: FILE_CARD.tile,
    height: FILE_CARD.tile,
    borderRadius: FILE_CARD.tileRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  file: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FILE_CARD.gap,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: FILE_CARD.radius,
    paddingVertical: FILE_CARD.padding,
    paddingLeft: FILE_CARD.padding,
    paddingRight: FILE_CARD.paddingRight,
  },
});
