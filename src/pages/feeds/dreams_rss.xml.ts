import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import fs from "fs";
import path from "path";

export async function GET({ site }) {
  const dreams = (await getCollection("obsidianPublishedDreams"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return rss({
    title: "Meadow - Dreams",
    description: "Wondering about life, the meaning of the universe, and everything.",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: dreams.map((dream) => {
      const item: any = {
        title: `${dream.title}`,
        link: `/dreams/${dream.slug}/`,
        pubDate: dream.publishedAt,
        description: dream.body,
      };

      // Add audio enclosure if the dream has an audio version
      if (dream.audioVersion) {
        try {
          const audioPath = path.join(process.cwd(), "public", dream.audioVersion.replace(/^\//, ""));
          const stats = fs.statSync(audioPath);

          item.enclosure = {
            url: new URL(dream.audioVersion, site).href,
            length: stats.size,
            type: "audio/wav",
          };
        } catch (error) {
          console.warn(`Could not get file stats for audio: ${dream.audioVersion}`, error);
        }
      }

      return item;
    }),
    customData: `<language>en-us</language>`,
  });
}
