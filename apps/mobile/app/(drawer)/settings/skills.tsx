import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable } from "react-native";
import { Button, Column, Row, RNHostView, ScrollView, Text, TextInput } from "@expo/ui";
import { M3Host } from "@/components/m3";
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
  // Bumped after a source is added: the field remounts empty.
  const [repoRound, setRepoRound] = useState(0);

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
      setRepoRound((round) => round + 1);
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
    <M3Host style={{ flex: 1 }}>
      <ScrollView>
        <Column>
          <Text textStyle={{ color: colors.muted }}>Installed</Text>
          {installed.isPending ? (
            <RNHostView matchContents>
              <ActivityIndicator color={colors.accent} />
            </RNHostView>
          ) : null}
          {installed.data?.length === 0 ? <Text textStyle={{ color: colors.muted }}>No skills installed.</Text> : null}
          {installed.data?.map((skill) => (
            <Column key={skill.folder}>
              <Text>{skill.name}</Text>
              <Text textStyle={{ color: skill.error ? colors.danger : colors.muted }}>{skill.error ?? skill.description}</Text>
              <Button variant="text" label="Uninstall" onPress={() => uninstall.mutate(skill.folder)} />
            </Column>
          ))}

          <Text textStyle={{ color: colors.muted }}>Sources</Text>
          <Row alignment="center">
            {sources.data?.map((source) => {
              const selected = repo === source.repo;
              return (
                <RNHostView key={source.repo} matchContents>
                  {/* Long press removes a source: a touch target that @expo/ui does not offer, so it stays React Native. */}
                  <Pressable
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
                  >
                    <M3Host matchContents>
                      <Text textStyle={{ color: selected ? colors.accent : colors.text }}>{source.repo}</Text>
                    </M3Host>
                  </Pressable>
                </RNHostView>
              );
            })}
          </Row>
          <Row alignment="center">
            <TextInput key={`repo-${repoRound}`} onChangeText={setNewRepo} placeholder="owner/repo" autoCapitalize="none" autoCorrect={false} />
            <Button
              variant="filled"
              label={addSource.isPending ? "Adding…" : "Add"}
              disabled={!newRepo.trim() || addSource.isPending}
              onPress={() => newRepo.trim() && addSource.mutate(newRepo.trim())}
            />
          </Row>

          {repo ? (
            <>
              <Text textStyle={{ color: colors.muted }}>{`Catalog · ${repo}`}</Text>
              {catalog.isPending ? (
                <RNHostView matchContents>
                  <ActivityIndicator color={colors.accent} />
                </RNHostView>
              ) : null}
              {catalog.isError ? <Text textStyle={{ color: colors.danger }}>{errorMessage(catalog.error)}</Text> : null}
              {catalog.data?.map((skill) => {
                const already = installedFolders.has(skill.folder);
                return (
                  <Column key={`${skill.path}-${skill.folder}`}>
                    <Text>{skill.name}</Text>
                    <Text textStyle={{ color: colors.muted }}>{skill.description}</Text>
                    <Button variant="text" label={already ? "Installed" : "Install"} disabled={already || install.isPending} onPress={() => install.mutate(skill)} />
                  </Column>
                );
              })}
            </>
          ) : null}
        </Column>
      </ScrollView>
    </M3Host>
  );
}
