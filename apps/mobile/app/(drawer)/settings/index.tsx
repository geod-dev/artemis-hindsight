import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth";
import { initialsOf, avatarHex } from "@/lib/avatar";
import { usePreferences } from "@/preferences";

const ITEMS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/memory", label: "Memory" },
  { href: "/settings/skills", label: "Skills" },
  { href: "/settings/admin", label: "Administration" },
  { href: "/settings/danger", label: "Danger zone" },
] as const;

export default function SettingsIndex() {
  const router = useRouter();
  const { colors } = usePreferences();
  const { state, signOut } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 8 }}>
      {user ? (
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: avatarHex(user.avatarColor, user.username) }]}>
            <Text style={styles.avatarText}>{initialsOf(user.displayName ?? user.username)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>{user.displayName ?? user.username}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>@{user.username}</Text>
          </View>
        </View>
      ) : null}
      {ITEMS.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => router.push(item.href)}
          accessibilityRole="link"
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>{item.label}</Text>
          <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => {
          void signOut();
          // Settings are a screen of the app stack: leaving them for the gate sends the user to sign-in.
          router.replace("/");
        }}
        accessibilityRole="button"
        style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}
      >
        <Text style={{ color: colors.danger, fontSize: 16 }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16 },
});
