// FILE: src/pages/feeds/[tag].xml.ts
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { ObsidianPost } from "../../schemas";

export const getStaticPaths = async () => {
  const allPosts = (await getCollection("obsidianPublishedPosts"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const allTags = allPosts.flatMap((post) => post.tags).sort();

  const tags = Array.from(new Set(allTags));

  return tags.map((tag) => {
    const postsWithTag = allPosts.filter((post) => post.tags.includes(tag));
    return {
      params: { tagName: `${tag}` },
      props: { posts: postsWithTag, tag: tag },
    };
  });
};

export async function GET({ params, site, props }) {
  const tag = params.tagName;
  const posts = props.posts;

  return rss({
    title: `Meadow - Posts tagged with ${tag}`,
    description: `Posts tagged with ${tag} on Meadow`,
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: posts.map((post: ObsidianPost) => ({
      title: post.title,
      link: `/blog/${post.slug}/`,
      pubDate: post.publishedAt,
      description: post.body,
    })),
    customData: `<language>en-us</language>`,
  });
}
