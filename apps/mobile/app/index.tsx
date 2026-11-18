import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth";
import { usePreferences } from "@/preferences";
import { BrandMark } from "@/components/brand-mark";

/** The entry point: sends the user to sign-in, profile setup or the chat, depending on the session. */
export default function Gate() {
  const { state, retry, signOut } = useAuth();
  const { colors } = usePreferences();

  if (state.status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
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
    <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
      <Text style={[styles.title, { color: colors.text }]}>Server unreachable</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{state.serverUrl}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{state.message}</Text>
      <Pressable onPress={retry} style={[styles.button, { backgroundColor: colors.accent }]}>
        <Text style={[styles.buttonText, { color: colors.accentText }]}>Try again</Text>
      </Pressable>
      <Pressable onPress={() => void signOut()} style={styles.link}>
        <Text style={{ color: colors.muted }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { fontSize: 20, fontWeight: "600" },
  body: { fontSize: 14, textAlign: "center" },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginTop: 8 },
  buttonText: { fontSize: 15, fontWeight: "600" },
  link: { padding: 8 },
});
