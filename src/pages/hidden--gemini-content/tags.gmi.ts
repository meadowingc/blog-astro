import { getCollection } from "astro:content";
import { createGeminiHeader, createGeminiFooter } from "../../utils/gemini.js";

export async function GET() {
  const allTags = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .flatMap((post) => post.tags)
    .sort();

  const tags = Array.from(new Set(allTags));

  const tagCounts = tags.reduce((acc, tag) => {
    acc[tag] = allTags.filter((t) => t === tag).length;
    return acc;
  }, {});

  let gemtext = createGeminiHeader("🏷️ Tags");

  gemtext += `Browse posts by tag.\n\n`;

  gemtext += `## All Tags\n\n`;

  for (const tag of tags) {
    gemtext += `=> /tags/${tag}.gmi ${tag} (${tagCounts[tag]} posts)\n`;
  }

  gemtext += `\n`;
  gemtext += createGeminiFooter();
  gemtext += `=> / ← Home\n`;
  gemtext += `=> /posts.gmi ← All Posts\n`;

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
