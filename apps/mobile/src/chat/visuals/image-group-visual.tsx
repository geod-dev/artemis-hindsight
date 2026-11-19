import { useQuery } from "@tanstack/react-query";
import { apiFetch, absoluteUrl, authHeaders } from "@/lib/api";
import { HorizontalRow, VisualError, VisualSkeleton } from "./shared";
import { openImageViewer } from "./image-viewer";
import { ImageTile, TILE_WIDTH } from "./image-tile";
import type { AspectRatio, ImageResult } from "./schemas";

export interface ImageGroupSpec {
  queries: string[];
  perQuery: number;
  aspectRatio: AspectRatio;
}

const RATIO_VALUE: Record<AspectRatio, number> = { "1:1": 1, "5:4": 5 / 4, "16:9": 16 / 9 };

/** Searches the group's queries through the server (the key stays there) and shows the results in one row of pictures. */
export function ImageGroupVisual({ spec }: { spec: ImageGroupSpec }) {
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

  const tileHeight = TILE_WIDTH / RATIO_VALUE[spec.aspectRatio];

  if (query.isPending) return <VisualSkeleton label="Loading images" height={tileHeight + 16} />;
  if (query.isError) {
    return <VisualError title="Images unavailable" message={query.error.message} onRetry={() => void query.refetch()} />;
  }
  if (query.data.length === 0) return <VisualError title="No images" message={spec.queries.join(", ")} />;

  return (
    <HorizontalRow gap={8}>
      {query.data.map((result, index) => (
        <ImageTile
          key={`${result.thumbnailUrl}-${index}`}
          source={{ uri: absoluteUrl(result.thumbnailUrl), headers: authHeaders() }}
          height={tileHeight}
          label={result.title || "Open image"}
          onPress={() => openImageViewer(query.data, index)}
        />
      ))}
    </HorizontalRow>
  );
}
