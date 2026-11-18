import { useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { X } from "lucide-react-native";
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

/**
 * An image in a message (the uploaded picture, or one the agent produced): a square rounded thumbnail. A tap opens it
 * full screen; the close button, or a tap outside the picture, closes it. Loaded with the session.
 */
export function ImagePart({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const { colors } = usePreferences();
  const source = { uri: absoluteUrl(url), headers: authHeaders() };
  if (failed) return <Text style={{ color: colors.muted }}>Image unavailable</Text>;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel="Open image" style={styles.thumb}>
        <Image source={source} onError={() => setFailed(true)} style={styles.thumbImage} accessibilityLabel="Image" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={styles.fullscreen}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close image" />
          <Image source={source} resizeMode="contain" style={styles.fullImage} />
          <SafeAreaView style={styles.closeBar} edges={["top"]} pointerEvents="box-none">
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={styles.closeButton}>
              <X size={22} color="#ffffff" />
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </>
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
  thumb: { width: 140, aspectRatio: 1, borderRadius: 16, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  fullscreen: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center" },
  fullImage: { width: "100%", height: "100%" },
  closeBar: { position: "absolute", top: 0, right: 0, padding: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
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
