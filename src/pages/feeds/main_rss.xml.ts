import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import fs from "fs";
import path from "path";

export async function GET({ site }) {
  const posts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .map((post) => ({
      ...post,
      slug: `/blog/${post.slug}/`,
    }));

  const dreams = (await getCollection("obsidianPublishedDreams"))
    .map((col) => col.data)
    .map((dream) => ({
      ...dream,
      title: `[DREAM] ${dream.title}`,
      slug: `/dreams/${dream.slug}/`,
    }));

  const everything = [...posts, ...dreams];
  everything.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return rss({
    title: "Meadow",
    description: "Wondering about life, the meaning of the universe, and everything.",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: everything.map((thing) => {
      const item: any = {
        title: `${thing.title}`,
        link: `${thing.slug}/`,
        pubDate: thing.publishedAt,
        description: thing.body,
      };

      // Add audio enclosure if the post has an audio version (only posts have audio, not dreams)
      if ("audioVersion" in thing && thing.audioVersion && typeof thing.audioVersion === "string") {
        try {
          const audioPath = path.join(process.cwd(), "public", thing.audioVersion.replace(/^\//, ""));
          const stats = fs.statSync(audioPath);

          item.enclosure = {
            url: new URL(thing.audioVersion, site).href,
            length: stats.size,
            type: "audio/wav",
          };
        } catch (error) {
          console.warn(`Could not get file stats for audio: ${thing.audioVersion}`, error);
        }
      }

      return item;
    }),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
