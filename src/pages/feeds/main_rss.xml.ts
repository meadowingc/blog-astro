import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return rss({
    title: "Meadow",
    description: "Wondering about life, the meaning of the universe, and everything.",
    site: context.site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: posts.map((post) => ({
      title: `${post.title}`,
      link: `/blog/${post.slug}/`,
      pubDate: post.publishedAt,
      description: post.body,
    })),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
