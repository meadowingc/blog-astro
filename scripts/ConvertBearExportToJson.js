import Papa from "papaparse";
import fs from "fs";
import path from "path";
import { marked } from "marked";

const csvText = fs.readFileSync("post_export.csv", "utf-8");
const allPages = Papa.parse(csvText, { header: true }).data;

const outputDir = path.join("src", "content", "bear_export");
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

fs.mkdirSync(outputDir, { recursive: true });

// Iterate over each page and save it as a JSON file
allPages
  .filter((page) => page.slug)
  .forEach((page) => {
    page["all tags"] = JSON.parse(page["all tags"]);
    page["content"] = marked(page["content"]);
    page["published date"] = new Date(page["published date"]);
    page["last modified"] = new Date(page["last modified"]);
    page["first published at"] = new Date(page["last modified"]);
    page["is page"] = page["is page"] === "True"
    page["publish"] = page["publish"] === "True"
    page["hidden"] = page["hidden"] === "True"
    page["pinned"] = page["pinned"] === "True"
    page["make discoverable"] = page["make discoverable"] === "True"

    const filePath = path.join(outputDir, `${page.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(page, null, 2), "utf-8");
  });

console.log("Pages have been saved to src/content/bear_export/");
