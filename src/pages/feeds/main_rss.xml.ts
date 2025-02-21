import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

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
    items: everything.map((thing) => ({
      title: `${thing.title}`,
      link: `${thing.slug}/`,
      pubDate: thing.publishedAt,
      description: thing.body,
    })),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
