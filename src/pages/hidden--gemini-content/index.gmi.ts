import { getCollection } from "astro:content";
import { SITE_EMAIL } from "../../consts";
import { createGeminiHeader, createGeminiFooter, formatGeminiDate } from "../../utils/gemini.js";

export async function GET() {
  const posts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 10); // Latest 10 posts

  const dreams = (await getCollection("obsidianPublishedDreams"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 5); // Latest 5 dreams

  let gemtext = createGeminiHeader(
    "🌱 Meadow's Gemini Space",
    "Wondering about life, the meaning of the universe, and everything.",
  );

  gemtext += `Welcome to my gemini space! This is a text-only version of my blog.\n\n`;
  gemtext += `If for any reason you want to contact me you can reach me at ${SITE_EMAIL}\n\n`;

  // Navigation
  gemtext += `## Navigation\n\n`;
  gemtext += `=> /posts.gmi 📝 All Blog Posts\n`;
  gemtext += `=> /dreams.gmi 💭 Dreams\n`;
  gemtext += `=> /about.gmi ℹ️ About\n\n`;

  // Recent posts
  gemtext += `## Recent Blog Posts\n\n`;
  for (const post of posts) {
    gemtext += `=> /blog/${post.slug}.gmi ${formatGeminiDate(post.publishedAt)} - ${post.title}\n`;
  }
  gemtext += `\n`;

  // Recent dreams
  if (dreams.length > 0) {
    gemtext += `## Recent Dreams\n\n`;
    for (const dream of dreams) {
      gemtext += `=> /dreams/${dream.slug}.gmi ${formatGeminiDate(dream.publishedAt)} - ${dream.title}\n`;
    }
    gemtext += `\n`;
  }

  gemtext += createGeminiFooter();

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
