import { getCollection } from "astro:content";
import { createGeminiHeader, createGeminiFooter, formatGeminiDate } from "../../utils/gemini.js";

export async function GET() {
  const posts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  let gemtext = createGeminiHeader("📝 All Blog Posts", undefined, true);

  gemtext += `All ${posts.length} blog posts, sorted by date (newest first):\n\n`;

  // Group posts by year
  const postsByYear = posts.reduce(
    (acc, post) => {
      const year = post.publishedAt.getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(post);
      return acc;
    },
    {} as Record<number, typeof posts>,
  );

  const years = Object.keys(postsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  for (const year of years) {
    gemtext += `## ${year}\n\n`;
    for (const post of postsByYear[year]) {
      gemtext += `=> /blog/${post.slug}.gmi ${formatGeminiDate(post.publishedAt)} - ${post.title}\n`;
    }
    gemtext += `\n`;
  }

  gemtext += createGeminiFooter();
  gemtext += `=> / ← Home\n`;

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
