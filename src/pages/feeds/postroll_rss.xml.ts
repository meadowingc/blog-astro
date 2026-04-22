import rss from "@astrojs/rss";
import { fetchPostrollBookmarks } from "../../utils/readeck";

export async function GET({ site }: { site: URL }) {
    const bookmarks = await fetchPostrollBookmarks();

    return rss({
        title: "Meadow — Postroll",
        description: "A rolling list of posts, articles, and pages I've been reading from around the web.",
        site: site,
        stylesheet: "/rss/pretty-feed-v3.xsl",
        items: bookmarks.map((b) => ({
            title: `${b.is_marked ? "⭐ " : ""}${b.title || b.url}`,
            link: b.url,
            pubDate: new Date(b.updated),
            description: b.description || "",
        })),
        customData: `<language>en-us</language>`,
    });
}
