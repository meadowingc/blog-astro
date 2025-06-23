import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET({ site }) {
  const nowPages = (await getCollection("historicalNowPages"))
    .map((col) => col.data)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return rss({
    title: "Meadow - Now Pages",
    description: "Updates on what I'm currently thinking about, reading, working on, etc",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: nowPages.map((nowPage) => ({
      title: nowPage.title,
      link: `/now/${nowPage.slug}/`,
      pubDate: nowPage.date,
      description: nowPage.body,
    })),
    customData: `<language>en-us</language>`,
  });
}
