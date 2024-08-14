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
    // `<title>` field in output xml
    title: 'Meadow',
    // `<description>` field in output xml
    description: 'A humble Astronaut’s guide to the stars',
    // Pull in your project "site" from the endpoint context
    // https://docs.astro.build/en/reference/api-reference/#contextsite
    site: context.site,
    // Array of `<item>`s in output xml
    // See "Generating items" section for examples using content collections and glob imports
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
