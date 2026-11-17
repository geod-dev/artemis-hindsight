import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { setStatusBarStyle, StatusBar } from "expo-status-bar";
import { setBackgroundColorAsync } from "expo-system-ui";
import { StatusBar as NativeStatusBar } from "react-native";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth";
import { PreferencesProvider, usePreferences } from "@/preferences";

function Shell() {
  const { colors, isDark } = usePreferences();

  // The status bar follows the app theme (light text on dark). Set both declaratively and imperatively: on Android
  // edge-to-edge the component prop alone does not always reach the window.
  // The app's own theme drives the status bar, not the phone's: Android otherwise follows the system setting
  // (userInterfaceStyle "automatic"), so choosing Dark in the app left light icons on a light screen.
  useEffect(() => {
    setStatusBarStyle(isDark ? "light" : "dark");
    // React Native's own call sets the Android window's light/dark icons directly.
    NativeStatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
    // The strip above the headers is the system status bar, not the app: it takes the window background, so it must
    // match the app's background or it reads as a gap above every bar (and it is not tappable).
    void setBackgroundColorAsync(colors.background);
  }, [isDark, colors.background]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          // Material 3 top app bar: surface colour, no elevation shadow, title left-aligned in the larger medium style.
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTitleAlign: "left",
          headerTitleStyle: { fontSize: 22, fontWeight: "500" },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="setup-profile" options={{ title: "Your profile" }} />
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // One query client for the whole app: the conversation list, messages, memory and skills are server state.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <PreferencesProvider>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <Shell />
                </BottomSheetModalProvider>
              </AuthProvider>
            </PreferencesProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
