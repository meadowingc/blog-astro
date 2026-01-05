// Legacy vomits feed - now serves wordvomit-tagged posts from the blog
// Kept for backwards compatibility with existing subscribers
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import fs from "fs";
import path from "path";

export async function GET({ site }) {
  const vomitPosts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .filter((post) => post.tags.includes("wordvomit"))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

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
        try {
          const audioPath = path.join(process.cwd(), "public", post.audioVersion.replace(/^\//, ""));
          const stats = fs.statSync(audioPath);

          item.enclosure = {
            url: new URL(post.audioVersion, site).href,
            length: stats.size,
            type: "audio/wav",
          };
        } catch (error) {
          console.warn(`Could not get file stats for audio: ${post.audioVersion}`, error);
        }
      }

      return item;
    }),
    customData: `<language>en-us</language>`,
  });
}
