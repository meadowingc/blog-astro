import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
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

  const nowPages = (await getCollection("historicalNowPages"))
    .map((col) => col.data)
    .map((nowPage) => ({
      ...nowPage,
      title: `[NOW] ${nowPage.title}`,
      slug: `/now/${nowPage.slug}/`,
      publishedAt: nowPage.date, // Map date to publishedAt for consistency
    }));

  const everything = [...posts, ...dreams, ...nowPages];
  everything.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const mimeTypes: Record<string, string> = { ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };

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

      if ("audioVersion" in thing && thing.audioVersion && typeof thing.audioVersion === "string") {
        const ext = path.extname(thing.audioVersion).toLowerCase();
        const fileSize = "audioFileSize" in thing && typeof thing.audioFileSize === "number" ? thing.audioFileSize : 0;
        item.enclosure = {
          url: thing.audioVersion,
          length: fileSize,
          type: mimeTypes[ext] || "audio/mp4",
        };
      }

      return item;
    }),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
