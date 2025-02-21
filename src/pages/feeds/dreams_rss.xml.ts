import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET({ site }) {
  const dreams = (await getCollection("obsidianPublishedDreams"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return rss({
    title: "Meadow - Dreams",
    description: "Wondering about life, the meaning of the universe, and everything.",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: dreams.map((post) => ({
      title: `${post.title}`,
      link: `/dreams/${post.slug}/`,
      pubDate: post.publishedAt,
      description: post.body,
    })),
    customData: `<language>en-us</language>`,
  });
}
