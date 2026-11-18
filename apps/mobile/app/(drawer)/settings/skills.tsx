import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { usePreferences } from "@/preferences";

interface InstalledSkill {
  folder: string;
  name: string;
  description: string;
  path: string;
  error?: string;
}

interface SkillSource {
  repo: string;
  description: string;
  builtIn: boolean;
}

interface MarketplaceSkill {
  folder: string;
  name: string;
  description: string;
  path: string;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again later.";
}

/** Skills in Claude's format: the installed ones, the sources they come from, and the catalog of each source. */
export default function SkillsSettings() {
  const { colors } = usePreferences();
  const queryClient = useQueryClient();
  const [repo, setRepo] = useState<string | null>(null);
  const [newRepo, setNewRepo] = useState("");

  const installed = useQuery({
    queryKey: ["skills", "installed"],
    queryFn: () => apiFetch<{ skills: InstalledSkill[] }>("/api/skills/installed"),
    select: (data) => data.skills,
  });
  const sources = useQuery({
    queryKey: ["skills", "sources"],
    queryFn: () => apiFetch<{ sources: SkillSource[] }>("/api/skills/sources"),
    select: (data) => data.sources,
  });
  const catalog = useQuery({
    queryKey: ["skills", "catalog", repo],
    queryFn: () => apiFetch<{ skills: MarketplaceSkill[] }>(`/api/skills/marketplace?${new URLSearchParams({ repo: repo ?? "" })}`),
    select: (data) => data.skills,
    enabled: repo !== null,
  });

  const invalidateInstalled = () => queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });

  const install = useMutation({
    mutationFn: (skill: MarketplaceSkill) =>
      apiFetch("/api/skills/marketplace/install", { method: "POST", json: { repo, path: skill.path } }),
    onSuccess: () => invalidateInstalled(),
    onError: (error) => Alert.alert("Install failed", errorMessage(error)),
  });

  const uninstall = useMutation({
    mutationFn: (folder: string) => apiFetch(`/api/skills/installed/${encodeURIComponent(folder)}`, { method: "DELETE" }),
    onSuccess: () => invalidateInstalled(),
    onError: (error) => Alert.alert("Uninstall failed", errorMessage(error)),
  });

  const addSource = useMutation({
    mutationFn: (value: string) => apiFetch<SkillSource>("/api/skills/sources", { method: "POST", json: { repo: value } }),
    onSuccess: (source) => {
      setNewRepo("");
      setRepo(source.repo);
      void queryClient.invalidateQueries({ queryKey: ["skills", "sources"] });
    },
    onError: (error) => Alert.alert("Source rejected", errorMessage(error)),
  });

  const removeSource = useMutation({
    mutationFn: (value: string) => apiFetch(`/api/skills/sources?${new URLSearchParams({ repo: value })}`, { method: "DELETE" }),
    onSuccess: (_data, value) => {
      if (repo === value) setRepo(null);
      void queryClient.invalidateQueries({ queryKey: ["skills", "sources"] });
    },
    onError: (error) => Alert.alert("Remove failed", errorMessage(error)),
  });

  const installedFolders = new Set((installed.data ?? []).map((skill) => skill.folder));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={[styles.section, { color: colors.muted }]}>Installed</Text>
      {installed.isPending ? <ActivityIndicator color={colors.accent} /> : null}
      {installed.data?.length === 0 ? <Text style={{ color: colors.muted }}>No skills installed.</Text> : null}
      {installed.data?.map((skill) => (
        <View key={skill.folder} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{skill.name}</Text>
          <Text style={{ color: skill.error ? colors.danger : colors.muted, fontSize: 13 }}>
            {skill.error ?? skill.description}
          </Text>
          <Pressable onPress={() => uninstall.mutate(skill.folder)} accessibilityRole="button" style={{ alignSelf: "flex-end" }}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>Uninstall</Text>
          </Pressable>
        </View>
      ))}

      <Text style={[styles.section, { color: colors.muted }]}>Sources</Text>
      <View style={styles.wrap}>
        {sources.data?.map((source) => {
          const selected = repo === source.repo;
          return (
            <Pressable
              key={source.repo}
              onPress={() => setRepo(selected ? null : source.repo)}
              onLongPress={() => {
                if (!source.builtIn) {
                  Alert.alert("Remove source", source.repo, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => removeSource.mutate(source.repo) },
                  ]);
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: selected ? colors.accent : "transparent" }]}
            >
              <Text style={{ color: selected ? colors.accentText : colors.text, fontSize: 13 }}>{source.repo}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={newRepo}
          onChangeText={setNewRepo}
          placeholder="owner/repo"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <Pressable
          onPress={() => newRepo.trim() && addSource.mutate(newRepo.trim())}
          disabled={!newRepo.trim() || addSource.isPending}
          accessibilityRole="button"
          style={[styles.addButton, { backgroundColor: colors.accent, opacity: newRepo.trim() ? 1 : 0.4 }]}
        >
          {addSource.isPending ? <ActivityIndicator color={colors.accentText} /> : <Text style={{ color: colors.accentText }}>Add</Text>}
        </Pressable>
      </View>

      {repo ? (
        <>
          <Text style={[styles.section, { color: colors.muted }]}>Catalog · {repo}</Text>
          {catalog.isPending ? <ActivityIndicator color={colors.accent} /> : null}
          {catalog.isError ? <Text style={{ color: colors.danger }}>{errorMessage(catalog.error)}</Text> : null}
          {catalog.data?.map((skill) => {
            const already = installedFolders.has(skill.folder);
            return (
              <View key={`${skill.path}-${skill.folder}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{skill.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{skill.description}</Text>
                <Pressable
                  onPress={() => install.mutate(skill)}
                  disabled={already || install.isPending}
                  accessibilityRole="button"
                  style={{ alignSelf: "flex-end" }}
                >
                  <Text style={{ color: already ? colors.muted : colors.accent, fontSize: 14 }}>{already ? "Installed" : "Install"}</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  addButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, minWidth: 80, alignItems: "center" },
});
