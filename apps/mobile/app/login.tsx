import { Redirect, useRouter } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Button, Column, RNHostView, Text, TextInput } from "@expo/ui";
import { BrandMark } from "@/components/brand-mark";
import { M3Host } from "@/components/m3";
import { useAuth } from "@/auth";
import { ApiError } from "@/lib/api";
import { usePreferences } from "@/preferences";

/** Sign-in with the Artemis account. The server is fixed (lib/config.ts), so there is no address field. */
export default function LoginScreen() {
  const { state, signIn } = useAuth();
  const { colors } = usePreferences();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // The keyboard's own animation: its height is negative while it is open. The screen's bottom padding follows it, so the
  // form ends right above the keyboard, moving with it.
  const { height } = useReanimatedKeyboardAnimation();
  const keyboardPadding = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -height.value) }));

  if (state.status === "signedIn") return <Redirect href="/" />;

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
      router.replace("/");
    } catch (cause) {
      if (cause instanceof ApiError || cause instanceof Error) setError(cause.message);
      else setError("Server unreachable. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: colors.background }, keyboardPadding]}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled">
        <RNHostView matchContents>
          <BrandMark size={96} />
        </RNHostView>
        <M3Host matchContents={{ vertical: true }}>
          <Column>
            <Text textStyle={{ color: colors.muted }}>Sign in with your account.</Text>
            <Text>Username</Text>
            {/* The autofill hints let password managers fill these fields (autoComplete). */}
            <TextInput
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
            />
            <Text>Password</Text>
            <TextInput
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={() => void submit()}
            />
            {error ? <Text textStyle={{ color: colors.danger }}>{error}</Text> : null}
            <Button
              variant="filled"
              disabled={!canSubmit}
              style={{ backgroundColor: colors.accent }}
              label={busy ? "Signing in…" : "Sign in"}
              onPress={() => void submit()}
            />
          </Column>
        </M3Host>
        {busy ? (
          <RNHostView matchContents>
            <ActivityIndicator color={colors.accent} />
          </RNHostView>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}
