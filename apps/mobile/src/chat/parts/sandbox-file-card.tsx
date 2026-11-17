import { ListItem, RNHostView, Text } from "@expo/ui";
import { useState } from "react";
import { ActivityIndicator, Alert, Image } from "react-native";
import * as Sharing from "expo-sharing";
import { absoluteUrl, authHeaders } from "@/lib/api";
import { extensionLabel, mediaTypeOf, baseName, sandboxFileUrl } from "@/lib/sandbox-files";
import { fileKind } from "@/lib/file-icons";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
import { downloadToCache } from "./file-part";

/**
 * A file the agent produced, as a row: a thumbnail for an image or the type's icon, the name, the type, and an action
 * icon. A tap downloads the file with the session and opens the share sheet. Drawn from the sandbox path the agent
 * wrote in its link.
 */
export function SandboxFileCard({ conversationId, path }: { conversationId: string; path: string }) {
  const [busy, setBusy] = useState(false);
  const name = baseName(path);
  const mediaType = mediaTypeOf(name);
  const isImage = mediaType.startsWith("image/");
  const { glyph, tint } = fileKind(name, mediaType);
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
    <M3Host matchContents={{ vertical: true }}>
      <ListItem onPress={() => void open()}>
        <Text>{name}</Text>
        <ListItem.Supporting>
          <Text>{type}</Text>
        </ListItem.Supporting>
        <ListItem.Leading>
          {isImage ? (
            <RNHostView matchContents>
              <Image source={{ uri: absoluteUrl(url), headers: authHeaders() }} style={{ width: 40, height: 40 }} resizeMode="cover" />
            </RNHostView>
          ) : (
            <Glyph name={glyph} color={tint} />
          )}
        </ListItem.Leading>
        <ListItem.Trailing>
          {busy ? (
            <RNHostView matchContents>
              <ActivityIndicator />
            </RNHostView>
          ) : (
            <Glyph name={isImage ? "eye" : "download"} />
          )}
        </ListItem.Trailing>
      </ListItem>
    </M3Host>
  );
}
