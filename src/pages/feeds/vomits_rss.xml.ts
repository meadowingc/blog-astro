// Legacy vomits feed - now serves wordvomit-tagged posts from the blog
// Kept for backwards compatibility with existing subscribers
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import path from "path";

export async function GET({ site }) {
  const vomitPosts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .filter((post) => post.tags.includes("wordvomit"))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const mimeTypes: Record<string, string> = { ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };

  return rss({
    title: "Meadow - Vomits (now part of Blog)",
    description: "Stream-of-consciousness posts. This feed is now part of the main blog feed.",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: vomitPosts.map((post) => {
      const item: any = {
        title: `${post.title}`,
        link: `/blog/${post.slug}/`,
        pubDate: post.publishedAt,
        description: post.body,
      };

      if (post.audioVersion) {
        const ext = path.extname(post.audioVersion).toLowerCase();
        item.enclosure = {
          url: post.audioVersion,
          length: post.audioFileSize || 0,
          type: mimeTypes[ext] || "audio/mp4",
        };
      }

      return item;
    }),
    customData: `<language>en-us</language>`,
  });
}
