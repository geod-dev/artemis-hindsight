import { Stack } from "expo-router";
import { BackButton } from "@/components/back-button";
import { usePreferences } from "@/preferences";

/**
 * The settings as a native stack inside the drawer. Subpages get the system back (and its predictive back preview on
 * Android); the main page's arrow goes back to the page the settings were opened from.
 */
export default function SettingsLayout() {
  const { colors } = usePreferences();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings", headerLeft: () => <BackButton /> }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="appearance" options={{ title: "Appearance" }} />
      <Stack.Screen name="memory" options={{ title: "Memory" }} />
      <Stack.Screen name="skills" options={{ title: "Skills" }} />
      <Stack.Screen name="admin" options={{ title: "Administration" }} />
      <Stack.Screen name="danger/index" options={{ title: "Danger zone" }} />
      <Stack.Screen name="danger/archived" options={{ title: "Archived chats" }} />
    </Stack>
  );
}
