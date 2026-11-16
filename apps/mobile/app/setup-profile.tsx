import { Redirect, useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useAuth } from "@/auth";
import { ProfileForm } from "@/components/profile-form";
import { usePreferences } from "@/preferences";

/** First sign-in: the profile (name and color) is required before the chat opens, as on the web app. */
export default function SetupProfileScreen() {
  const { state } = useAuth();
  const { colors } = usePreferences();
  const router = useRouter();

  if (state.status !== "signedIn") return <Redirect href="/" />;
  if (state.user.profileComplete) return <Redirect href="/new" />;

  return (
    <ScrollView style={{ backgroundColor: colors.background }}>
      <ProfileForm
        initialDisplayName={state.user.displayName}
        initialColor={state.user.avatarColor}
        submitLabel="Continue"
        onSaved={() => router.replace("/new")}
      />
    </ScrollView>
  );
}
