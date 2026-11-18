import { useCallback, useEffect } from "react";
import { BackHandler, Dimensions } from "react-native";
import { Redirect, usePathname, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ConversationsDrawer } from "@/components/conversations-drawer";
import { BackButton } from "@/components/back-button";
import { renderTopBar, topBarOptions } from "@/components/top-bar";
import { useAuth } from "@/auth";
import { usePreferences } from "@/preferences";
import { getReturnTo } from "@/lib/return-to";
import { useSwipeLocked } from "@/lib/swipe-lock";
import { awaitSidewaysScrolls, useSidewaysScrolls } from "@/lib/sideways-scroll";
import { useLiveListUpdates } from "@/queries/live-updates";

/** Everything after sign-in: the chat (with the conversation list as a drawer) and the settings. */
export default function DrawerLayout() {
  const { state } = useAuth();
  const { colors } = usePreferences();
  // The lists follow the server while the app is open (a change made in the web app or on another device shows here).
  useLiveListUpdates(state.status === "signedIn");
  // The drawer's swipe is off while a dictate press is held (see lib/swipe-lock.ts).
  const swipeLocked = useSwipeLocked();
  // The drawer's pan waits for every sideways scroll on screen to fail, natively (lib/sideways-scroll.ts).
  const scrolls = useSidewaysScrolls();
  // The same function while the scrolls on screen do not change: the drawer rebuilds its pan only then. A new function on
  // every render would rebuild the pan (react-native-drawer-layout memoizes it on this function), and a rebuild during a
  // touch breaks the sideways scroll under the finger.
  const configureGestureHandler = useCallback(<Pan,>(pan: Pan): Pan => awaitSidewaysScrolls(pan, scrolls), [scrolls]);
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
        // The same top bar as the settings and the root stack (components/top-bar.ts).
        ...topBarOptions(colors),
        header: renderTopBar,
        sceneStyle: { backgroundColor: colors.background },
        drawerType: "front",
        swipeEnabled: !swipeLocked,
        configureGestureHandler,
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
