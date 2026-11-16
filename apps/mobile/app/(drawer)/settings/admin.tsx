import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { usePreferences } from "@/preferences";

interface AdminUser {
  username: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

/** The admin key header the server checks on every admin request. It lives in this screen's state only. */
function adminCall<T>(key: string, path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), "x-admin-key": key } });
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

/** Accounts, for the administrator of the server: create, archive, reset a password, delete. Same as the web admin. */
export default function AdminSettings() {
  const { colors } = usePreferences();
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const users = useQuery({
    queryKey: ["admin", "users", unlocked],
    queryFn: () => adminCall<{ users: AdminUser[] }>(unlocked ?? "", "/api/admin/users"),
    select: (data) => data.users,
    enabled: unlocked !== null,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "users", unlocked] });
  const fail = (error: unknown) => Alert.alert("Action failed", errorMessage(error));

  const create = useMutation({
    mutationFn: () => adminCall(unlocked ?? "", "/api/admin/users", { method: "POST", json: { username: newUsername.trim(), password: newPassword } }),
    onSuccess: () => {
      setNewUsername("");
      setNewPassword("");
      void refresh();
    },
    onError: fail,
  });

  const setArchived = useMutation({
    mutationFn: ({ username, archived }: { username: string; archived: boolean }) =>
      adminCall(unlocked ?? "", `/api/admin/users/${encodeURIComponent(username)}/status`, { method: "POST", json: { archived } }),
    onSuccess: () => void refresh(),
    onError: fail,
  });

  const resetPasswordFor = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      adminCall(unlocked ?? "", `/api/admin/users/${encodeURIComponent(username)}/password`, { method: "POST", json: { password } }),
    onSuccess: () => {
      setResetFor(null);
      setResetPassword("");
      Alert.alert("Password reset");
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: (username: string) =>
      adminCall(unlocked ?? "", `/api/admin/users/${encodeURIComponent(username)}`, { method: "DELETE", json: { confirm: username } }),
    onSuccess: () => void refresh(),
    onError: fail,
  });

  const confirmDelete = (username: string) =>
    Alert.alert("Delete account", `The account "${username}" and its data will be deleted. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(username) },
    ]);

  const field = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];

  if (unlocked === null) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>Enter the server admin key. It is kept on this screen only.</Text>
        <TextInput value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" placeholder="Admin key" placeholderTextColor={colors.muted} style={field} />
        <Pressable
          onPress={() => key && setUnlocked(key)}
          disabled={!key}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.accent, opacity: key ? 1 : 0.4 }]}
        >
          <Text style={{ color: colors.accentText, fontWeight: "600" }}>Open</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      {users.isPending ? <ActivityIndicator color={colors.accent} /> : null}
      {users.isError ? (
        <Text style={{ color: colors.danger }}>{errorMessage(users.error)}</Text>
      ) : null}

      <Text style={[styles.section, { color: colors.muted }]}>Nouveau compte</Text>
      <TextInput value={newUsername} onChangeText={setNewUsername} autoCapitalize="none" placeholder="Username" placeholderTextColor={colors.muted} style={field} />
      <TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Password" placeholderTextColor={colors.muted} style={field} />
      <Pressable
        onPress={() => create.mutate()}
        disabled={!newUsername.trim() || !newPassword || create.isPending}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.accent, opacity: newUsername.trim() && newPassword ? 1 : 0.4 }]}
      >
        <Text style={{ color: colors.accentText, fontWeight: "600" }}>Create account</Text>
      </Pressable>

      <Text style={[styles.section, { color: colors.muted }]}>Comptes</Text>
      {users.data?.map((user) => {
        const archived = user.status === "archived";
        return (
          <View key={user.username} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
              {user.username} <Text style={{ color: colors.muted, fontWeight: "400", fontSize: 12 }}>{archived ? "· archived" : "· active"}</Text>
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={() => setArchived.mutate({ username: user.username, archived: !archived })} accessibilityRole="button">
                <Text style={{ color: colors.accent }}>{archived ? "Reactivate" : "Archive"}</Text>
              </Pressable>
              <Pressable onPress={() => setResetFor(resetFor === user.username ? null : user.username)} accessibilityRole="button">
                <Text style={{ color: colors.accent }}>Password</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(user.username)} accessibilityRole="button">
                <Text style={{ color: colors.danger }}>Delete</Text>
              </Pressable>
            </View>
            {resetFor === user.username ? (
              <View style={{ gap: 8 }}>
                <TextInput value={resetPassword} onChangeText={setResetPassword} secureTextEntry placeholder="New password" placeholderTextColor={colors.muted} style={field} />
                <Pressable
                  onPress={() => resetPasswordFor.mutate({ username: user.username, password: resetPassword })}
                  disabled={!resetPassword}
                  accessibilityRole="button"
                  style={[styles.button, { backgroundColor: colors.accent, opacity: resetPassword ? 1 : 0.4 }]}
                >
                  <Text style={{ color: colors.accentText, fontWeight: "600" }}>Save</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  section: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 10 },
  actions: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
});
