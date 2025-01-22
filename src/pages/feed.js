import rss from '@astrojs/rss';
import { getCollection } from "astro:content";

export async function GET(context) {
  const bearPosts = (await getCollection("kittyPosts"))
    .map((col) => col.data)
    .filter((post) => post.Published && !post.IsPage)
    .sort((a, b) => b.PublishedDate - a.PublishedDate);

  return rss({
    title: 'Meadow',
    description: 'Wondering about life, the meaning of the universe, and everything.',
    site: context.site,
    stylesheet: '/rss/pretty-feed-v3.xsl',
    items: bearPosts.map((post) => ({
      title: `${post.Title}`,
      link: `/blog/${post.Slug}/`,
      pubDate: post.PublishedDate,
      description: post.Body,
    })),
    // (optional) inject custom xml
    customData: `<language>en-us</language>`,
  });
}
