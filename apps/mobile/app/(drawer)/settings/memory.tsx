import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { usePreferences } from "@/preferences";

interface MemoryNode {
  id: string;
  label: string;
  text: string;
  date: string;
  context: string;
  factType: string | null;
}

interface MemoryGraph {
  nodes: MemoryNode[];
  edges: unknown[];
}

// The same labels as the web app's memory graph.
const FACT_LABELS: Record<string, string> = {
  world: "Fact",
  experience: "Experience",
  observation: "Observation",
  mental_model: "Mental model",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

/** What Artemis remembers about the user, one card per memory, each deletable. Same data as the web memory graph. */
export default function MemorySettings() {
  const { colors } = usePreferences();
  const queryClient = useQueryClient();
  const graph = useQuery({
    queryKey: ["memory-graph"],
    queryFn: () => apiFetch<MemoryGraph>("/api/memory/graph"),
    staleTime: 0,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memory-graph"] }),
    onError: (error) => Alert.alert("Delete failed", error instanceof ApiError ? error.message : "Try again later."),
  });

  const clearAll = useMutation({
    mutationFn: () => apiFetch("/api/memory", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memory-graph"] }),
    onError: (error) => Alert.alert("Clear failed", error instanceof ApiError ? error.message : "Try again later."),
  });

  const confirmClear = () =>
    Alert.alert("Clear all memory", "Artemis will forget everything it has kept about you. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear all", style: "destructive", onPress: () => clearAll.mutate() },
    ]);

  const confirmDelete = (node: MemoryNode) =>
    Alert.alert("Forget this memory", "Artemis will forget this memory. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Forget", style: "destructive", onPress: () => remove.mutate(node.id) },
    ]);

  if (graph.isPending) return <ActivityIndicator style={{ marginTop: 32 }} color={colors.accent} />;
  if (graph.isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>Memory is unavailable right now.</Text>
        <Pressable onPress={() => void graph.refetch()}>
          <Text style={{ color: colors.accent, marginTop: 8 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={graph.data.nodes}
      keyExtractor={(node) => node.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {graph.data.nodes.length} {graph.data.nodes.length === 1 ? "memory" : "memories"}
          </Text>
          {graph.data.nodes.length > 0 ? (
            <Pressable onPress={confirmClear} accessibilityRole="button">
              <Text style={{ color: colors.danger, fontSize: 13 }}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>Nothing remembered yet.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {(item.factType && FACT_LABELS[item.factType]) || "Memory"} · {formatDate(item.date)}
          </Text>
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{item.text || item.label}</Text>
          <Pressable onPress={() => confirmDelete(item)} accessibilityRole="button" style={{ alignSelf: "flex-end" }}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>Forget</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 6 },
});
