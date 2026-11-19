import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { Download } from "lucide-react-native";
import { baseName, sandboxFileUrl } from "@/lib/sandbox-files";
import { usePreferences } from "@/preferences";
import { ImageLightbox, openSandboxFile, serverImageSource } from "./file-part";
import { SandboxFileCard } from "./sandbox-file-card";

// The picture is drawn at its own aspect ratio, as wide as the reply allows but never taller than this.
// Same limit as the web app's SandboxImage (max-h-96).
const MAX_HEIGHT = 384;

/**
 * An image file in a reply (one the agent generated, or any image it linked), shown as the picture itself instead of a
 * file card: a spinner while it loads, then the picture, which opens full screen, with a button in its corner that
 * downloads it and opens the share sheet. If the picture cannot load, the file card is shown instead.
 */
export function SandboxImage({ conversationId, path }: { conversationId: string; path: string }) {
  const { colors } = usePreferences();
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [aspectRatio, setAspectRatio] = useState(1);
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const name = baseName(path);
  const source = useMemo(() => serverImageSource(sandboxFileUrl(conversationId, path)), [conversationId, path]);

  if (status === "failed") return <SandboxFileCard conversationId={conversationId} path={path} />;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    await openSandboxFile(conversationId, path);
    setSharing(false);
  };

  return (
    <View
      style={[
        styles.frame,
        { aspectRatio, maxWidth: MAX_HEIGHT * aspectRatio, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        onPress={() => setOpen(true)}
        disabled={status !== "loaded"}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Open ${name}`}
        style={StyleSheet.absoluteFill}
      >
        <Image
          source={source}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onLoad={(event) => {
            const { width, height } = event.nativeEvent.source;
            if (width > 0 && height > 0) setAspectRatio(width / height);
            setStatus("loaded");
          }}
          onError={() => setStatus("failed")}
        />
      </Pressable>
      {status === "loading" ? (
        <ActivityIndicator style={styles.spinner} color={colors.muted} />
      ) : (
        <Pressable
          onPress={() => void share()}
          accessibilityRole="button"
          accessibilityLabel={`Download ${name}`}
          hitSlop={8}
          style={({ pressed }) => [
            styles.download,
            { backgroundColor: `${colors.background}CC`, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {sharing ? <ActivityIndicator size="small" color={colors.text} /> : <Download size={16} color={colors.text} />}
        </Pressable>
      )}
      <ImageLightbox source={source} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "flex-start",
    width: "100%",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginVertical: 4,
  },
  spinner: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  download: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
