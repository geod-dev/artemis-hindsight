import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Button, Column, Text } from "@expo/ui";
import { useAuth } from "@/auth";
import { usePreferences } from "@/preferences";
import { BrandMark } from "@/components/brand-mark";
import { M3Host } from "@/components/m3";

/** The entry point: sends the user to sign-in, profile setup or the chat, depending on the session. */
export default function Gate() {
  const { state, retry, signOut } = useAuth();
  const { colors } = usePreferences();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <BrandMark size={120} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (state.status === "signedOut") return <Redirect href="/login" />;
  if (state.status === "signedIn") {
    if (!state.user.profileComplete) return <Redirect href="/setup-profile" />;
    return <Redirect href="/new" />;
  }

  // The server is unreachable: keep the session, let the user retry or change the server.
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <M3Host matchContents={{ vertical: true }}>
        <Column>
          <Text textStyle={{ color: colors.text }}>Server unreachable</Text>
          <Text textStyle={{ color: colors.muted }}>{state.serverUrl}</Text>
          <Text textStyle={{ color: colors.muted }}>{state.message}</Text>
          <Button variant="filled" label="Try again" style={{ backgroundColor: colors.accent }} onPress={retry} />
          <Button variant="text" label="Sign out" onPress={() => void signOut()} />
        </Column>
      </M3Host>
    </View>
  );
}
