import { getCollection } from "astro:content";

/**
 * Represents a backlink (a page that links to the current page)
 */
export interface Backlink {
  slug: string;
  title: string;
  path: string;
  type: "post" | "dream" | "page" | "now";
}

/**
 * Gets the backlinks for a specific page path from the precomputed backlinks collection.
 *
 * @param pagePath - The path to get backlinks for (e.g., "/blog/my-post")
 * @returns Array of backlinks for this page
 */
export async function getBacklinksForPage(pagePath: string): Promise<Backlink[]> {
  const backlinksCollection = await getCollection("backlinks");
  const cleanPath = pagePath === "/" ? "/" : pagePath.replace(/\/$/, "");

  const entry = backlinksCollection.find((item) => item.id === cleanPath);
  return entry?.data.backlinks ?? [];
}
