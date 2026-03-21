import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import path from "path";

export async function GET({ site }) {
  const dreams = (await getCollection("obsidianPublishedDreams"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const mimeTypes: Record<string, string> = { ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };

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

      if (dream.audioVersion) {
        const ext = path.extname(dream.audioVersion).toLowerCase();
        item.enclosure = {
          url: dream.audioVersion,
          length: dream.audioFileSize || 0,
          type: mimeTypes[ext] || "audio/mp4",
        };
      }

      return item;
    }),
    customData: `<language>en-us</language>`,
  });
}
