import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { Button, Column, Row, RNHostView, ScrollView, Text, TextInput } from "@expo/ui";
import { M3Host } from "@/components/m3";
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
  // Bumped after a save: the password fields remount empty.
  const [formRound, setFormRound] = useState(0);

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
      setFormRound((round) => round + 1);
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
      setFormRound((round) => round + 1);
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

  if (unlocked === null) {
    return (
      <M3Host style={{ flex: 1 }}>
        <Column>
          <Text textStyle={{ color: colors.muted }}>Enter the server admin key. It is kept on this screen only.</Text>
          <TextInput onChangeText={setKey} secureTextEntry autoCapitalize="none" placeholder="Admin key" />
          <Button variant="filled" label="Open" disabled={!key} onPress={() => key && setUnlocked(key)} />
        </Column>
      </M3Host>
    );
  }

  return (
    <M3Host style={{ flex: 1 }}>
      <ScrollView>
        <Column>
          {users.isPending ? (
            <RNHostView matchContents>
              <ActivityIndicator color={colors.accent} />
            </RNHostView>
          ) : null}
          {users.isError ? <Text textStyle={{ color: colors.danger }}>{errorMessage(users.error)}</Text> : null}

          <Text textStyle={{ color: colors.muted }}>Nouveau compte</Text>
          {/* The fields are remounted (key) after a successful create, so they come back empty. */}
          <TextInput key={`user-${formRound}`} onChangeText={setNewUsername} autoCapitalize="none" placeholder="Username" />
          <TextInput key={`pass-${formRound}`} onChangeText={setNewPassword} secureTextEntry placeholder="Password" />
          <Button
            variant="filled"
            label="Create account"
            disabled={!newUsername.trim() || !newPassword || create.isPending}
            onPress={() => create.mutate()}
          />

          <Text textStyle={{ color: colors.muted }}>Comptes</Text>
          {users.data?.map((user) => {
            const archived = user.status === "archived";
            return (
              <Column key={user.username}>
                <Text>{`${user.username} · ${archived ? "archived" : "active"}`}</Text>
                <Row alignment="center">
                  <Button
                    variant="text"
                    label={archived ? "Reactivate" : "Archive"}
                    onPress={() => setArchived.mutate({ username: user.username, archived: !archived })}
                  />
                  <Button
                    variant="text"
                    label="Password"
                    onPress={() => setResetFor(resetFor === user.username ? null : user.username)}
                  />
                  <Button variant="text" onPress={() => confirmDelete(user.username)}>
                    <Text textStyle={{ color: colors.danger }}>Delete</Text>
                  </Button>
                </Row>
                {resetFor === user.username ? (
                  <Column>
                    <TextInput key={`reset-${formRound}`} onChangeText={setResetPassword} secureTextEntry placeholder="New password" />
                    <Button
                      variant="filled"
                      label="Save"
                      disabled={!resetPassword}
                      onPress={() => resetPasswordFor.mutate({ username: user.username, password: resetPassword })}
                    />
                  </Column>
                ) : null}
              </Column>
            );
          })}
        </Column>
      </ScrollView>
    </M3Host>
  );
}
