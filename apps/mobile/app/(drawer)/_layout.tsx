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
  // On the settings' main page, the Android back button goes back to the page the settings were opened from. The subpages
  // are a native stack (see settings/_layout.tsx), so their back is the system's own, with its predictive preview.
  useEffect(() => {
    if (pathname !== "/settings") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.navigate(getReturnTo());
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
      {/* A project's full conversation list ("See more") and the create/edit form. Both go back to the project's new chat. */}
      <Drawer.Screen name="projects/[id]" options={{ title: "Project" }} />
      <Drawer.Screen name="projects/form" options={{ title: "Project", headerLeft: () => <BackButton to="/new" /> }} />
      {/* The settings are a native stack of their own (settings/_layout.tsx), so their headers and back come from the stack. */}
      <Drawer.Screen name="settings" options={{ headerShown: false }} />
    </Drawer>
  );
}
