import { useEffect } from "react";
import { BackHandler, Dimensions } from "react-native";
import { Redirect, usePathname, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ConversationsDrawer } from "@/components/conversations-drawer";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/auth";
import { usePreferences } from "@/preferences";
import { getReturnTo } from "@/lib/return-to";
import { usePushToTalkHeld } from "@/chat/push-to-talk";

/** Everything after sign-in: the chat (with the conversation list as a drawer) and the settings. */
export default function DrawerLayout() {
  const { state } = useAuth();
  const { colors } = usePreferences();
  // While a push-to-talk press is held, the drawer's swipe is off: a slide towards cancel or send must not open it.
  const pushToTalk = usePushToTalkHeld();
  const pathname = usePathname();
  const router = useRouter();
  // In the settings, the Android back button does what the header arrow does: a subpage goes to its section (the archived
  // chats go back to the danger zone, the other subpages to the settings main page), the main page goes back to the page
  // the settings were opened from.
  useEffect(() => {
    if (!pathname.startsWith("/settings")) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const parent = pathname === "/settings" ? getReturnTo() : pathname.startsWith("/settings/danger/") ? "/settings/danger" : "/settings";
      router.navigate(parent);
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
        swipeEnabled: !pushToTalk,
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
      <Drawer.Screen name="settings/danger/index" options={{ title: "Danger zone", headerLeft: () => <BackButton to="/settings" /> }} />
      <Drawer.Screen name="settings/danger/archived" options={{ title: "Archived chats", headerLeft: () => <BackButton to="/settings/danger" /> }} />
    </Drawer>
  );
}
