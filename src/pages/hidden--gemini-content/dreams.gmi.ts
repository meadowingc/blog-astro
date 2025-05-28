import { getCollection } from "astro:content";
import { createGeminiHeader, createGeminiFooter, formatGeminiDate } from "../../utils/gemini.js";

export async function GET() {
  const dreams = (await getCollection("obsidianPublishedDreams"))
    .map((col) => col.data)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  let gemtext = createGeminiHeader("💭 Dreams", undefined, true);

  gemtext += `I have been keeping a dream journal for a while now, and I thought it would be fun to share some of the most interesting dreams here!\n\n`;

  gemtext += `Note that these have received very little to no editing, except for the fact that I've anonymized every sensitive name and location. Enter at your own risk!\n\n`;

  gemtext += `All ${dreams.length} dreams, sorted by date (newest first):\n\n`;

  for (const dream of dreams) {
    gemtext += `=> /dreams/${dream.slug}.gmi ${formatGeminiDate(dream.publishedAt)} - ${dream.title}\n`;
  }

  gemtext += createGeminiFooter();
  gemtext += `=> / ← Home\n`;

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
