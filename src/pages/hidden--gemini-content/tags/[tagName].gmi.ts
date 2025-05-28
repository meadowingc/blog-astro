import { getCollection } from "astro:content";
import { createGeminiHeader, createGeminiFooter, formatGeminiDate } from "../../../utils/gemini.js";

export async function getStaticPaths() {
  const allPosts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const allTags = allPosts.flatMap((post) => post.tags).sort();
  const tags = Array.from(new Set(allTags));

  return tags.map((tag) => {
    const postsWithTag = allPosts.filter((post) => post.tags.includes(tag));
    return {
      params: { tagName: tag },
      props: { posts: postsWithTag, tag: tag },
    };
  });
}

export async function GET({ props }) {
  const { posts, tag } = props;

  let gemtext = createGeminiHeader(`🏷️ Tag: ${tag}`, undefined, true);

  gemtext += `Posts tagged with "${tag}" (${posts.length} posts):\n\n`;

  for (const post of posts) {
    gemtext += `=> /blog/${post.slug}.gmi ${formatGeminiDate(post.publishedAt)} - ${post.title}\n`;
  }

  gemtext += createGeminiFooter();
  gemtext += `=> /tags/ ← All Tags\n`;
  gemtext += `=> / ← Home\n`;

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
