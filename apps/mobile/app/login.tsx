import { Redirect, useRouter } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { BrandMark } from "@/components/brand-mark";
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
  // When a field takes focus, the form scrolls to its end, so the sign-in button stays above the keyboard.
  const scrollToEnd = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250);

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

  const field = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];

  return (
    // The keyboard controller's view, not React Native's: on Android the app is edge-to-edge, and there the native
    // KeyboardAvoidingView does not move the content when the keyboard opens.
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding" automaticOffset>
      <ScrollView ref={scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <BrandMark size={96} />
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>Sign in with your account.</Text>

        <Text style={[styles.label, { color: colors.muted }]}>Username</Text>
        {/* The autofill hints let Proton Pass and other password managers fill these fields: textContentType (iOS),
            autoComplete and importantForAutofill (Android). */}
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          autoComplete="username"
          onFocus={scrollToEnd}
          importantForAutofill="yes"
          style={field}
        />
        <Text style={[styles.label, { color: colors.muted }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          onFocus={scrollToEnd}
          importantForAutofill="yes"
          onSubmitEditing={() => void submit()}
          style={field}
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          style={[styles.button, { backgroundColor: colors.accent, opacity: canSubmit ? 1 : 0.4 }]}
        >
          {busy ? <ActivityIndicator color={colors.accentText} /> : <Text style={[styles.buttonText, { color: colors.accentText }]}>Sign in</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center" },
  hint: { fontSize: 15, textAlign: "center", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "500", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14, marginTop: 8 },
  button: { marginTop: 20, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
