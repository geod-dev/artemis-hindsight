import { useEffect } from "react";
import { BackHandler, Dimensions } from "react-native";
import { Redirect, usePathname, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ConversationsDrawer } from "@/components/conversations-drawer";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/auth";
import { usePreferences } from "@/preferences";

/** Everything after sign-in: the chat (with the conversation list as a drawer) and the settings. */
export default function DrawerLayout() {
  const { state } = useAuth();
  const { colors } = usePreferences();
  const pathname = usePathname();
  const router = useRouter();
  // On a settings subpage, the Android back button goes to the settings main page, as the header arrow does.
  useEffect(() => {
    if (!pathname.startsWith("/settings/")) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.navigate("/settings");
      return true;
    });
    return () => subscription.remove();
  }, [pathname, router]);
  if (state.status !== "signedIn") return <Redirect href="/" />;
  if (!state.user.profileComplete) return <Redirect href="/setup-profile" />;

  return (
    <Drawer
      drawerContent={(props) => <ConversationsDrawer {...props} />}
      screenOptions={{
        // Material 3 top app bar, as in the root stack: flat, left-aligned, larger medium title.
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitleStyle: { fontSize: 22, fontWeight: "500" },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
        drawerType: "front",
        // A swipe to the right opens the drawer from anywhere on the screen, not only from the left edge.
        swipeEdgeWidth: Dimensions.get("window").width,
        drawerStyle: { backgroundColor: colors.surface, width: 300 },
      }}
    >
      <Drawer.Screen name="new" options={{ title: "New conversation" }} />
      <Drawer.Screen name="c/[id]" options={{ title: "Conversation" }} />
      {/* Settings use the same drawer header as the conversations; a back arrow replaces the menu button. */}
      <Drawer.Screen name="settings/index" options={{ title: "Settings", headerLeft: () => <BackButton /> }} />
      <Drawer.Screen name="settings/profile" options={{ title: "Profile", headerLeft: () => <BackButton to="/settings" /> }} />
      <Drawer.Screen name="settings/appearance" options={{ title: "Appearance", headerLeft: () => <BackButton to="/settings" /> }} />
      <Drawer.Screen name="settings/memory" options={{ title: "Memory", headerLeft: () => <BackButton to="/settings" /> }} />
      <Drawer.Screen name="settings/skills" options={{ title: "Skills", headerLeft: () => <BackButton to="/settings" /> }} />
      <Drawer.Screen name="settings/admin" options={{ title: "Administration", headerLeft: () => <BackButton to="/settings" /> }} />
    </Drawer>
  );
}
