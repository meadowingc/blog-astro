import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import path from "path";

// this is a fallback feed for those people that were originally following me on
// Bearblog. It contains only posts.

export async function GET({ site }) {
  const bearPosts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const mimeTypes: Record<string, string> = { ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };

  return rss({
    title: "Meadow",
    description: "Wondering about life, the meaning of the universe, and everything.",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: bearPosts.map((post) => {
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
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
