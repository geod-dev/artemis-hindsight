import { useQuery } from "@tanstack/react-query";
import { Image, Linking, Pressable, ScrollView, Text } from "react-native";
import { apiFetch, absoluteUrl, authHeaders } from "@/lib/api";
import { usePreferences } from "@/preferences";
import { VisualError, VisualSkeleton } from "./shared";
import type { AspectRatio, ImageResult } from "./schemas";

export interface ImageGroupSpec {
  queries: string[];
  perQuery: number;
  aspectRatio: AspectRatio;
}

const RATIO_VALUE: Record<AspectRatio, number> = { "1:1": 1, "5:4": 5 / 4, "16:9": 16 / 9 };

/** Searches the group's queries through the server (the key stays there) and shows the results in one row. */
export function ImageGroupVisual({ spec }: { spec: ImageGroupSpec }) {
  const { colors } = usePreferences();
  const query = useQuery({
    queryKey: ["image-group", spec.queries, spec.perQuery],
    queryFn: async () => {
      const params = new URLSearchParams(spec.queries.map((q) => ["q", q]));
      params.set("n", String(spec.perQuery));
      const { results } = await apiFetch<{ results: ImageResult[] }>(`/api/image-search?${params}`);
      return results;
    },
    staleTime: Infinity,
    retry: 1,
  });

  const tileWidth = 150;
  const tileHeight = tileWidth / RATIO_VALUE[spec.aspectRatio];

  if (query.isPending) return <VisualSkeleton label="Loading images" height={tileHeight + 16} />;
  if (query.isError) {
    return <VisualError title="Images unavailable" message={query.error.message} onRetry={() => void query.refetch()} />;
  }
  if (query.data.length === 0) return <VisualError title="No images" message={spec.queries.join(", ")} />;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {query.data.map((result, index) => (
        <Pressable
          key={`${result.thumbnailUrl}-${index}`}
          accessibilityRole="link"
          accessibilityLabel={result.title || "Image result"}
          onPress={() => void Linking.openURL(result.pageUrl ?? result.imageUrl)}
          style={{ width: tileWidth }}
        >
          <Image
            source={{ uri: absoluteUrl(result.thumbnailUrl), headers: authHeaders() }}
            style={{ width: tileWidth, height: tileHeight, borderRadius: 12, backgroundColor: colors.surface }}
            resizeMode="cover"
          />
          {result.title ? (
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {result.title}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
