import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async () => {
  const posts = (await getCollection("obsidianPublishedPosts")).map((col) => col.data);
  const dreams = (await getCollection("obsidianPublishedDreams")).map((col) => col.data);

  // Combine and sort all content by date
  const allContent = [
    ...posts.map((post) => ({
      ...post,
      type: "blog" as const,
      url: `blog/${post.slug}.gmi`,
    })),
    ...dreams.map((dream) => ({
      ...dream,
      type: "dreams" as const,
      url: `dreams/${dream.slug}.gmi`,
    })),
  ]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 20); // Latest 20 entries

  const feedTitle = "Meadow";
  const feedDescription = "Meadow's main feed";
  const geminiBaseUrl = "gemini://gmi.meadow.cafe";
  const feedUrl = `${geminiBaseUrl}/`;
  const atomUrl = `${geminiBaseUrl}/atom.xml`;

  // Get the latest update date from content
  const latestUpdate = allContent.length > 0 ? new Date(allContent[0].publishedAt).toISOString() : new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${feedTitle}</title>
  <subtitle>${feedDescription}</subtitle>
  <link href="${atomUrl}" rel="self" type="application/atom+xml"/>
  <link href="${feedUrl}" rel="alternate" type="text/gemini"/>
  <id>${feedUrl}</id>
  <updated>${latestUpdate}</updated>
  <author>
    <name>Meadow</name>
    <email>hi@meadow.cafe</email>
  </author>
  <generator uri="https://astro.build/" version="4.0">Astro</generator>
${allContent
      .map((item) => {
        const entryUrl = `${geminiBaseUrl}/${item.url}`;

        return `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${entryUrl}" rel="alternate" type="text/gemini"/>
    <id>${entryUrl}</id>
    <published>${new Date(item.publishedAt).toISOString()}</published>
    <updated>${new Date(item.publishedAt).toISOString()}</updated>
  </entry>`;
      })
      .join("\n")}
</feed>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
    },
  });
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
