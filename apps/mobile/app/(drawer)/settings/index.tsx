import { useRouter } from "expo-router";
import { View } from "react-native";
import { Column, ListItem, Row, RNHostView, ScrollView, Text } from "@expo/ui";
import { Glyph } from "@/components/glyph";
import { M3Host } from "@/components/m3";
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
    <M3Host style={{ flex: 1 }}>
      <ScrollView>
        <Column>
          {user ? (
            <Row alignment="center">
              <RNHostView matchContents>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: avatarHex(user.avatarColor, user.username),
                  }}
                >
                  <M3Host matchContents>
                    <Text textStyle={{ color: "#ffffff" }}>{initialsOf(user.displayName ?? user.username)}</Text>
                  </M3Host>
                </View>
              </RNHostView>
              <Column>
                <Text>{user.displayName ?? user.username}</Text>
                <Text textStyle={{ color: colors.muted }}>{`@${user.username}`}</Text>
              </Column>
            </Row>
          ) : null}
          {ITEMS.map((item) => (
            <ListItem key={item.href} onPress={() => router.push(item.href)}>
              <Text>{item.label}</Text>
              <ListItem.Trailing>
                <Glyph name="chevronRight" />
              </ListItem.Trailing>
            </ListItem>
          ))}
          <ListItem
            onPress={() => {
              void signOut();
              // Settings are a screen of the app stack: leaving them for the gate sends the user to sign-in.
              router.replace("/");
            }}
          >
            <Text textStyle={{ color: colors.danger }}>Sign out</Text>
          </ListItem>
        </Column>
      </ScrollView>
    </M3Host>
  );
}
