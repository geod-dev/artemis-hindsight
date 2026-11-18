import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { FlatList, Image, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { X } from "lucide-react-native";
import { absoluteUrl, authHeaders } from "@/lib/api";
import type { ImageResult } from "./schemas";

// The pictures opened full screen. The viewer is mounted once, at the root of the app (ImageViewerHost in app/_layout.tsx), so
// it is never inside a message's gesture area.

const OPEN_MS = 240;
const CLOSE_MS = 200;
// How far down a drag must go, or how fast it must flick, to close the viewer.
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 900;

type Opened = { results: ImageResult[]; index: number } | null;

let opened: Opened = null;
const listeners = new Set<() => void>();

function setOpened(next: Opened): void {
  opened = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens a gallery's pictures full screen, on the tapped one. */
export function openImageViewer(results: ImageResult[], index: number): void {
  setOpened({ results, index });
}

/**
 * The full-screen viewer: a pager that swipes left and right, with each picture's caption, its source and a link to its page.
 * It opens and closes with a scale and fade; a downward drag follows the finger and closes it when released far enough.
 */
export function ImageViewerHost() {
  const current = useSyncExternalStore(subscribe, () => opened);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // The picture in view, shown in the counter.
  const [page, setPage] = useState(0);
  // Whether the modal is shown: it stays shown while its exit animation runs.
  const [mounted, setMounted] = useState(false);
  // 0 = closed, 1 = open: drives the scale, the fade and the backdrop.
  const entrance = useSharedValue(0);
  // How far the viewer has been dragged down, in points.
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (current) {
      setPage(current.index);
      setMounted(true);
      dragY.value = 0;
      entrance.value = withTiming(1, { duration: OPEN_MS });
    }
  }, [current, dragY, entrance]);

  const finish = useCallback(() => {
    setMounted(false);
    setOpened(null);
  }, []);

  // Closes with a scale and fade, from the close button or the Android back button.
  const dismiss = () => {
    entrance.value = withTiming(0, { duration: CLOSE_MS }, (done) => {
      if (done) scheduleOnRN(finish);
    });
  };

  // A drag that is released far enough, or flicked, carries on down and closes; otherwise it springs back to the top.
  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .failOffsetX([-16, 16])
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) {
        dragY.value = withTiming(windowHeight, { duration: CLOSE_MS });
        entrance.value = withTiming(0, { duration: CLOSE_MS }, (done) => {
          if (done) scheduleOnRN(finish);
        });
      } else {
        dragY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, dragY.value / windowHeight);
    return { opacity: 0.95 * entrance.value * (1 - 0.6 * progress) };
  });
  const contentStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, dragY.value / windowHeight);
    return {
      opacity: entrance.value,
      transform: [{ translateY: dragY.value }, { scale: (0.9 + 0.1 * entrance.value) * (1 - 0.15 * progress) }],
    };
  });

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.root, contentStyle]}>
            {/* A safe-area view inside the modal: its own window, so the close button stays below the status bar. */}
            <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
              {current ? (
                <>
                  <View style={styles.header}>
                    <Text style={styles.counter}>{`${page + 1} / ${current.results.length}`}</Text>
                    <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={16} style={styles.close}>
                      <X size={24} color="#fff" />
                    </Pressable>
                  </View>
                  <View style={styles.root}>
                    <FlatList
                      key={current.index}
                      data={current.results}
                      horizontal
                      pagingEnabled
                      initialScrollIndex={current.index}
                      getItemLayout={(_, i) => ({ length: windowWidth, offset: windowWidth * i, index: i })}
                      keyExtractor={(item, i) => `${item.thumbnailUrl}-${i}`}
                      showsHorizontalScrollIndicator={false}
                      onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / windowWidth))}
                      renderItem={({ item }) => <ViewerPage result={item} width={windowWidth} height={windowHeight} />}
                    />
                  </View>
                </>
              ) : null}
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** One picture of the viewer: the picture, then its caption, source and link underneath. */
function ViewerPage({ result, width, height }: { result: ImageResult; width: number; height: number }) {
  const link = result.pageUrl ?? result.imageUrl;
  return (
    <View style={{ width, height, justifyContent: "center" }}>
      <Image source={fullImageSource(result)} resizeMode="contain" style={{ width, height: height * 0.7 }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 6 }}>
        {result.title ? <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{result.title}</Text> : null}
        {result.source ? <Text style={{ color: "#bbb", fontSize: 13 }}>{result.source}</Text> : null}
        <Pressable onPress={() => void Linking.openURL(link)} accessibilityRole="link" accessibilityLabel="Open the page">
          <Text style={{ color: "#8ab4ff", fontSize: 14, textDecorationLine: "underline" }}>Open the page</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The full-size picture. A path on the server needs the session; a picture on another site is fetched without it, so the
 * token never goes to another site.
 */
function fullImageSource(result: ImageResult) {
  return result.imageUrl.startsWith("/")
    ? { uri: absoluteUrl(result.imageUrl), headers: authHeaders() }
    : { uri: result.imageUrl };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  counter: { color: "#fff", fontSize: 14 },
  close: { padding: 4 },
});
