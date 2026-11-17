import { Button, ListItem, RNHostView, Text } from "@expo/ui";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { absoluteUrl, authHeaders } from "@/lib/api";
import { fileKind } from "@/lib/file-icons";
import { baseName, extensionLabel, sandboxFileUrl } from "@/lib/sandbox-files";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";

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
 * An image in a message (the uploaded picture, or one the agent produced): a thumbnail. A tap opens it full screen; the
 * close button, or a tap outside the picture, closes it. Loaded with the session. The picture itself is a React Native
 * Image (@expo/ui has none); the full-screen controls are @expo/ui.
 */
export function ImagePart({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const source = { uri: absoluteUrl(url), headers: authHeaders() };
  if (failed) {
    return (
      <M3Host matchContents>
        <Text>Image unavailable</Text>
      </M3Host>
    );
  }
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
            <M3Host matchContents>
              <Button variant="text" onPress={() => setOpen(false)}>
                <Glyph name="close" color="#ffffff" />
              </Button>
            </M3Host>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

/** A file in a message: its name and type, opened through the share sheet. */
export function FilePart({ url, filename, mimeType }: { url: string; filename?: string; mimeType?: string }) {
  const [busy, setBusy] = useState(false);
  const name = filename ?? baseName(url);
  const { glyph, tint } = fileKind(name, mimeType);

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
    <M3Host matchContents={{ vertical: true }}>
      <ListItem onPress={() => void open()}>
        <Text>{name}</Text>
        <ListItem.Supporting>
          <Text>{extensionLabel(name) || "File"}</Text>
        </ListItem.Supporting>
        <ListItem.Leading>
          <Glyph name={glyph} color={tint} />
        </ListItem.Leading>
        {busy ? (
          <ListItem.Trailing>
            <RNHostView matchContents>
              <ActivityIndicator />
            </RNHostView>
          </ListItem.Trailing>
        ) : null}
      </ListItem>
    </M3Host>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 140, aspectRatio: 1, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  fullscreen: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center" },
  fullImage: { width: "100%", height: "100%" },
  closeBar: { position: "absolute", top: 0, right: 0 },
});
