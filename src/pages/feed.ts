import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import fs from "fs";
import path from "path";

// this is a fallback feed for those people that were originally following me on
// Bearblog. It contains only posts.

export async function GET({ site }) {
  const bearPosts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

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

      // Add audio enclosure if the post has an audio version
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
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
