import { ScrollView } from "react-native";
import { useAuth } from "@/auth";
import { ProfileForm } from "@/components/profile-form";
import { usePreferences } from "@/preferences";

/** Saved as it changes, like the appearance settings (the web's profile page does the same). */
export default function ProfileSettings() {
  const { colors } = usePreferences();
  const { state } = useAuth();
  if (state.status !== "signedIn") return null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} keyboardShouldPersistTaps="handled">
      <ProfileForm mode="auto" initialDisplayName={state.user.displayName} initialColor={state.user.avatarColor} />
    </ScrollView>
  );
}
