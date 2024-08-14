import rss from '@astrojs/rss';
import { getCollection } from "astro:content";

export async function GET(context) {
  const bearPosts = (await getCollection("bear_export"))
    .map((postCol) => {
      const post = postCol.data;
      post["published date"] = new Date(post["published date"]);
      post["last modified"] = new Date(post["last modified"]);
      post["first published at"] = new Date(post["last modified"]);

      return post;
    })
    .filter((post) => post.publish && !post["is page"])
    .sort((a, b) => b["published date"] - a["published date"]);

  return rss({
    title: 'Meadow',
    description: 'A humble Astronaut’s guide to the stars',
    site: context.site,
    stylesheet: '/rss/pretty-feed-v3.xsl',
    items: bearPosts.map((post) => ({
      title: `${post.title}`,
      link: `/blog/${post.slug}/`,
      pubDate: post["published date"],
      description: post.content,
    })),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
