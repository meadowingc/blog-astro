import { createGeminiHeader, createGeminiFooter } from "../../utils/gemini.js";

export async function GET() {
  let gemtext = createGeminiHeader("ℹ️ About");

  gemtext += `Hi 🍃 Thanks for visiting my gemini space!\n\n`;

  gemtext += `My main goal here is to discover how I can be more authentic to myself through explorations in writing. I also write because I believe blogs are great at making us appreciate more what we have in common, rather than highlighting our differences.\n\n`;

  gemtext += `I've been struggling to think what this blog is actually about, but the truth is that I myself don't know. I write frequently, about whatever topic strikes my fancy. I've noticed that lately I write a lot about writing, blogging, reflecting on the past (or future), on society, on the mind, a little bit about parenting, plus the odd topic here and there.\n\n`;

  gemtext += `I think I take myself too seriously, which is something I'm trying to undo.\n\n`;

  gemtext += `Something I would like to eventually start doing with this space is to get into the habit of writing short stories, but haven't managed to find a way to do it yet (writing posts/essays comes much easier)!\n\n`;

  gemtext += `## Contact\n\n`;
  gemtext += `If for any reason you want to contact me you can reach me at meadowingc@proton.me\n\n`;

  gemtext += `## Other Spaces\n\n`;
  gemtext += `=> https://meadow.cafe/ My main website\n`;
  gemtext += `=> https://bsky.app/profile/meadow.cafe Bluesky\n\n`;

  gemtext += createGeminiFooter();
  gemtext += `=> / ← Home\n`;

  return new Response(gemtext, {
    headers: {
      "Content-Type": "text/gemini; charset=utf-8",
    },
  });
}
