import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET({ site }) {
  const bearPosts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return rss({
    title: "Meadow",
    description: "Wondering about life, the meaning of the universe, and everything.",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: bearPosts.map((post) => ({
      title: `${post.title}`,
      link: `/blog/${post.slug}/`,
      pubDate: post.publishedAt,
      description: post.body,
    })),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
