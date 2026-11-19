import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { imageSearches, type StoredImageResult } from "../db/schema";

/** The stored results of an image query, or undefined when it was never searched. */
export async function findImageSearch(query: string): Promise<StoredImageResult[] | undefined> {
  const [row] = await getDb()
    .select({ results: imageSearches.results })
    .from(imageSearches)
    .where(eq(imageSearches.query, query))
    .limit(1);
  return row?.results;
}

/** Stores the results of an image query. A concurrent search of the same query that stored first wins. */
export async function saveImageSearch(query: string, results: StoredImageResult[]): Promise<void> {
  // Replaces a search stored before the image sizes were kept (see searchImages).
  await getDb()
    .insert(imageSearches)
    .values({ query, results })
    .onConflictDoUpdate({ target: imageSearches.query, set: { results, createdAt: new Date() } });
}
