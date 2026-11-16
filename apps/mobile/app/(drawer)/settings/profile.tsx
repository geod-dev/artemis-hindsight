import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useAuth } from "@/auth";
import { ProfileForm } from "@/components/profile-form";
import { usePreferences } from "@/preferences";

export default function ProfileSettings() {
  const router = useRouter();
  const { colors } = usePreferences();
  const { state } = useAuth();
  if (state.status !== "signedIn") return null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }}>
      <ProfileForm
        initialDisplayName={state.user.displayName}
        initialColor={state.user.avatarColor}
        submitLabel="Save"
        onSaved={() => router.navigate("/settings")}
      />
    </ScrollView>
  );
}
