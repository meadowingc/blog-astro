import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import fs from "fs";
import path from "path";

export async function GET({ site }) {
  const wildflowers = (await getCollection("obsidianPublishedWildflowers"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return rss({
    title: "Meadow - Vomits",
    description: "Erratic misfiring of an addled brain.",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: wildflowers.map((wildflower) => {
      const item: any = {
        title: `${wildflower.title}`,
        link: `/vomits/${wildflower.slug}/`,
        pubDate: wildflower.publishedAt,
        description: wildflower.body,
      };

      // Add audio enclosure if the wildflower has an audio version
      if (wildflower.audioVersion) {
        try {
          const audioPath = path.join(process.cwd(), "public", wildflower.audioVersion.replace(/^\//, ""));
          const stats = fs.statSync(audioPath);

          item.enclosure = {
            url: new URL(wildflower.audioVersion, site).href,
            length: stats.size,
            type: "audio/wav",
          };
        } catch (error) {
          console.warn(`Could not get file stats for audio: ${wildflower.audioVersion}`, error);
        }
      }

      return item;
    }),
    customData: `<language>en-us</language>`,
  });
}
