import { getCollection } from "astro:content";

export async function GET() {
  const posts = await getCollection("obsidianPublishedPosts");
  const dreams = await getCollection("obsidianPublishedDreams");

  const allTags = posts.flatMap((post) => post.data.tags).sort();
  const tags = Array.from(new Set(allTags));

  const files = [
    // Main pages
    "/atom.xml",
    "/index.gmi",
    "/posts.gmi",
    "/dreams.gmi",
    "/about.gmi",
    "/tags.gmi",

    // Blog posts
    ...posts.map((post) => `/blog/${post.data.slug}.gmi`),

    // Dreams
    ...dreams.map((dream) => `/dreams/${dream.data.slug}.gmi`),

    // Tags
    ...tags.map((tag) => `/tags/${tag}.gmi`),
  ];

  const manifest = {
    generated_at: new Date().toISOString(),
    base_url: "https://meadow.cafe/gemini",
    total_files: files.length,
    files: files.sort(),
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
