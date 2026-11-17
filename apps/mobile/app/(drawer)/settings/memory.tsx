import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Alert, FlatList, View } from "react-native";
import { Button, Column, Row, RNHostView, Text } from "@expo/ui";
import { M3Host } from "@/components/m3";
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

  if (graph.isPending) {
    return (
      <RNHostView matchContents>
        <ActivityIndicator color={colors.accent} />
      </RNHostView>
    );
  }
  if (graph.isError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <M3Host matchContents={{ vertical: true }}>
          <Text textStyle={{ color: colors.muted }}>Memory is unavailable right now.</Text>
          <Button variant="text" label="Try again" onPress={() => void graph.refetch()} />
        </M3Host>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={graph.data.nodes}
      keyExtractor={(node) => node.id}
      ListHeaderComponent={
        <M3Host matchContents={{ vertical: true }}>
          <Row alignment="center">
            <Text textStyle={{ color: colors.muted }}>
              {`${graph.data.nodes.length} ${graph.data.nodes.length === 1 ? "memory" : "memories"}`}
            </Text>
            {graph.data.nodes.length > 0 ? <Button variant="text" label="Clear all" onPress={confirmClear} /> : null}
          </Row>
        </M3Host>
      }
      ListEmptyComponent={
        <M3Host matchContents>
          <Text textStyle={{ color: colors.muted }}>Nothing remembered yet.</Text>
        </M3Host>
      }
      renderItem={({ item }) => (
        <M3Host matchContents={{ vertical: true }}>
          <Column>
            <Text textStyle={{ color: colors.muted }}>
              {`${(item.factType && FACT_LABELS[item.factType]) || "Memory"} · ${formatDate(item.date)}`}
            </Text>
            <Text>{item.text || item.label}</Text>
            <Button variant="text" label="Forget" onPress={() => confirmDelete(item)} />
          </Column>
        </M3Host>
      )}
    />
  );
}
