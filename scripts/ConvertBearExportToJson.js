import fs from "fs";
import { Marked } from 'marked';
import markedFootnote from 'marked-footnote';
import Papa from "papaparse";
import path from "path";

const outputDir = path.join("src", "content", "bear_export");
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

fs.mkdirSync(outputDir, { recursive: true });

const csvText = fs.readFileSync("post_export.csv", "utf-8");
const allPages = Papa.parse(csvText, { header: true })
  .data
  .filter((page) => page.slug)
  .map((page) => {
    const markedParser = new Marked().use(markedFootnote());

    page["all tags"] = JSON.parse(page["all tags"]);
    page["content"] = markedParser.parse(page["content"]);
    page["published date"] = new Date(page["published date"]);
    page["last modified"] = new Date(page["last modified"]);
    page["first published at"] = new Date(page["last modified"]);
    page["is page"] = page["is page"] === "True"
    page["publish"] = page["publish"] === "True"
    page["hidden"] = page["hidden"] === "True"
    page["pinned"] = page["pinned"] === "True"
    page["make discoverable"] = page["make discoverable"] === "True"

    return page;
  });

const slugToPage = allPages.reduce((acc, page) => {
  acc[page.slug] = page;
  return acc;
}, {});

// Iterate over each page and save it as a JSON file
allPages
  .forEach((page) => {
    const linkPattern = /href="\/([^"]+)"/g;
    page.content = page.content.replace(linkPattern, (match, slug) => {
      slug = slug.replace(/\/$/, "");
      if (slugToPage[slug] && !slugToPage[slug]["is page"]) {
        return `href="/blog/${slug}"`;
      }
      return match;
    });


    const filePath = path.join(outputDir, `${page.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(page, null, 2), "utf-8");
  });

console.log("Pages have been saved to src/content/bear_export/");
