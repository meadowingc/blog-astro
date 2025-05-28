import { getCollection } from "astro:content";
import { createGeminiHeader, createGeminiFooter, formatGeminiDate, htmlToGemtext } from "../../../utils/gemini.js";

export async function getStaticPaths() {
  const posts = await getCollection("obsidianPublishedPosts");

  return posts.map((post) => ({
    params: { slug: post.data.slug },
    props: { post: post.data },
  }));
}

export async function GET({ props }) {
  const { post } = props;

  let gemtext = createGeminiHeader(post.title);

  // Post metadata
  gemtext += `Published: ${formatGeminiDate(post.publishedAt)}\n\n`;

  // Tags
  if (post.tags && post.tags.length > 0) {
    gemtext += `Tags: ${post.tags.join(", ")}\n\n`;
  }

  gemtext += `---\n\n`;

  // Convert HTML content to gemtext
  gemtext += htmlToGemtext(post.body);

  gemtext += createGeminiFooter();

  // Navigation
  gemtext += `=> /posts.gmi ← Back to all posts\n`;
  gemtext += `=> / ← Home\n`;

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
