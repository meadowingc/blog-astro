import { getCollection } from "astro:content";
import { createGeminiHeader, createGeminiFooter, formatGeminiDate, htmlToGemtext } from "../../../utils/gemini.js";

export async function getStaticPaths() {
  const dreams = await getCollection("obsidianPublishedDreams");

  return dreams.map((dream) => ({
    params: { slug: dream.data.slug },
    props: { dream: dream.data },
  }));
}

export async function GET({ props }) {
  const { dream } = props;

  let gemtext = createGeminiHeader(`💭 ${dream.title}`);

  // Dream metadata
  gemtext += `Published: ${formatGeminiDate(dream.publishedAt)}\n\n`;

  gemtext += `---\n\n`;

  // Convert HTML content to gemtext
  gemtext += htmlToGemtext(dream.body);

  gemtext += createGeminiFooter();

  // Navigation
  gemtext += `=> /dreams.gmi ← Back to all dreams\n`;
  gemtext += `=> / ← Home\n`;

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
