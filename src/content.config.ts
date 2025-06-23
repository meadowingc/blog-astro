import { AtpAgent } from "@atproto/api";
import { defineCollection } from "astro:content";
import { execSync } from "child_process";
import fs from "fs";
import * as matter from "gray-matter";
import { JSDOM } from "jsdom";
import { DateTime } from "luxon";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import os from "os";

import path from "path";
import { BlueskyImageSchema, NowPageSchema, ObsidianDreamSchema, ObsidianPageSchema, ObsidianPostSchema } from "./schemas";

const CACHE_DURATION = 5 * 60 * 60 * 1000; // hours in milliseconds
const BLUESKY_IMAGES_CACHE_FILE_PATH = path.join(os.tmpdir(), "AstroBlog__BlueskyImagesCache.json");

// Load all attachments from Obsidian folder _attachments
const baseObsidianPath = path.resolve("../obsidian-brain/Brian/");
const attachmentsFolderPath = path.join(baseObsidianPath, "_attachments");
const publicImagesFolderPath = path.resolve("./public/obsidian_images");
const publicAudioFolderPath = path.resolve("./public/obsidian_audio");

// now put every filename in the allKnownAttachments array if the file is not a directory (or recurse)
const allKnownAttachments: string[] = [];
function loadAttachments(folderPath: string) {
  const files = fs.readdirSync(folderPath);

  files.forEach((file) => {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      loadAttachments(filePath);
    } else {
      allKnownAttachments.push(filePath);
    }
  });
}

loadAttachments(attachmentsFolderPath);

function copyImageToPublicFolder(imagePath: string) {
  const imageName = path.basename(imagePath);
  const destinationPath = path.join(publicImagesFolderPath, imageName);

  if (!fs.existsSync(publicImagesFolderPath)) {
    fs.mkdirSync(publicImagesFolderPath, { recursive: true });
  }

  fs.copyFileSync(imagePath, destinationPath);
}

function copyAudioToPublicFolder(audioPath: string) {
  const audioName = path.basename(audioPath);
  const destinationPath = path.join(publicAudioFolderPath, audioName);

  if (!fs.existsSync(publicAudioFolderPath)) {
    fs.mkdirSync(publicAudioFolderPath, { recursive: true });
  }

  fs.copyFileSync(audioPath, destinationPath);
  return `/obsidian_audio/${audioName}`;
}

async function loadDataPostsInFolder(
  folderPath: string,
  needsPublishedDate: boolean,
): Promise<{ id: string; body: string; [key: string]: any }[]> {
  const actualFolderPath = path.resolve(path.join(baseObsidianPath, folderPath));
  const markdownFiles = fs.readdirSync(actualFolderPath).filter((file) => file.endsWith(".md"));

  console.log(`Found ${markdownFiles.length} markdown files under Obsidian folder: ${folderPath}`);

  const markedParser = new Marked().use(markedFootnote());

  return await Promise.all(
    markdownFiles.map(async (file) => {
      const postContent = fs.readFileSync(path.join(actualFolderPath, file), "utf-8");

      const grayMatterParsed = matter.default(postContent);
      const frontMatter = grayMatterParsed.data;

      // check for attachments and replace with the actual file path if it exists
      // Convert wikilinks to markdown links
      grayMatterParsed.content = grayMatterParsed.content.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
        if (!allKnownAttachments.includes(path.join(attachmentsFolderPath, p1))) {
          throw new Error(
            `Wikilink is assumed to be an attachment, and attachment '${p1}' was not found in Obsidian attachments folder, for Obsidian file '${file}'`,
          );
        }

        // copy the image to the public folder
        copyImageToPublicFolder(path.join(attachmentsFolderPath, p1));

        return `<div class="obsidian-image"><img loading="lazy" src="/obsidian_images/${p1}" alt="${p1}" /></div>`;
      });

      let body = markedParser.parse(grayMatterParsed.content);

      //  await if body is a promise
      if (body instanceof Promise) {
        body = await body;
      }

      // wallback title
      frontMatter.title ||= file.replace(/\.md$/, "");

      if (needsPublishedDate) {
        if (!frontMatter.publishedAt) {
          throw new Error(`Item '${file}' does not have a publishedAt date!`);
        }

        frontMatter.publishedAt = frontMatter.publishedAt.trim().replace("−", "-");

        const dateWithOffset = frontMatter.publishedAt.substring(0, frontMatter.publishedAt.lastIndexOf(" "));
        let zoneOffset = frontMatter.publishedAt.substring(frontMatter.publishedAt.lastIndexOf(" ") + 1).replace("GMT", "UTC");

        // Transform zoneOffset from -0600 to -6
        const match = zoneOffset.match(/([+-])(\d{2})(\d{2})/);
        if (match) {
          const sign = match[1];
          const hours = parseInt(match[2], 10);
          zoneOffset = `UTC${sign}${hours}`;
        }

        const parsedDate = DateTime.fromFormat(dateWithOffset, "yyyy-MM-dd HH:mm:ss", { zone: zoneOffset });

        if (!parsedDate.isValid) {
          throw new Error(
            `Invalid PublishedDate format for post with title "${frontMatter.title}": "${frontMatter.publishedAt}"`,
          );
        }

        frontMatter.publishedAt = parsedDate.toJSDate();
      }

      if (!frontMatter.slug) {
        function convertToSlug(text) {
          return text
            .toLowerCase()
            .replace(/[^\w ]+/g, "")
            .replace(/ +/g, "-");
        }

        frontMatter.slug = convertToSlug(frontMatter.title);
      }

      // Handle audio version if specified in frontmatter
      if (frontMatter.audioVersion) {
        const audioPath = path.join(attachmentsFolderPath, "audio", frontMatter.audioVersion);
        if (fs.existsSync(audioPath)) {
          frontMatter.audioVersion = copyAudioToPublicFolder(audioPath);
        } else {
          console.warn(`Audio file not found: ${frontMatter.audioVersion} for post ${file}`);
          frontMatter.audioVersion = undefined;
        }
      }

      return {
        id: file,
        filename: file,
        body: body,
        ...frontMatter,
      };
    }),
  );
}

const obsidianPublishedPosts = defineCollection({
  schema: ObsidianPostSchema,
  loader: async () => {
    console.log(">> Loading Obsidian Published Posts data");
    const now = new Date();

    const posts = (await loadDataPostsInFolder("Blog/Published", true))
      .filter((post) => post.publishedAt <= now)
      .map((post) => {
        post.tags ||= [];
        post.metaImage ||= `https://meadow.cafe/open-graph/blog--${post.slug}.png`;
        return post;
      })
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    // check that all slugs are unique
    const slugSet = new Set();
    posts.forEach((post) => {
      if (slugSet.has(post.slug)) {
        throw new Error(`Duplicate slug found: ${post.slug}`);
      }
      slugSet.add(post.slug);
    });

    return posts;
  },
});

const obsidianPublishedPages = defineCollection({
  schema: ObsidianPageSchema,
  loader: async () => {
    console.log(">> Loading Obsidian Published Pages data");
    const pagesInFolder = await loadDataPostsInFolder("Blog/Pages", false);

    // -------- special handle of links pages to create gumbo
    const gumboPage = pagesInFolder.find((page) => page.id === "Links.md");

    if (!gumboPage) {
      throw new Error("Could not find Links.md file");
    }

    let parts = gumboPage.body.split("<!-- GUMBO START -->");
    const beforeGumbo = parts[0];
    parts = parts[1].split("<!-- GUMBO END -->");
    const gumboDoc = new JSDOM(parts[0]).window.document;
    const afterGumbo = parts[1];

    const gumboLinks = Array.from(gumboDoc.querySelectorAll("a"))
      .filter((link: any) => link.href.startsWith("http"))
      .map((link: any) => {
        return `<a href="${link.href}" title="${link.innerHTML}">*</a>`;
      });

    // shuffle
    for (let i = gumboLinks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gumboLinks[i], gumboLinks[j]] = [gumboLinks[j], gumboLinks[i]];
    }

    const gumboAnchorStrings = gumboLinks.join(" ");

    gumboPage.body = beforeGumbo + gumboAnchorStrings + afterGumbo;

    return pagesInFolder;
  },
});

const obsidianPublishedDreams = defineCollection({
  schema: ObsidianDreamSchema,
  loader: async () => {
    console.log(">> Loading Obsidian Published Dreams data");
    const dreamsInFolder = (await loadDataPostsInFolder("Blog/Dreams", false))
      // only include dreams that have a publishedAt date
      .filter((dream) => dream.publishedAt);

    return dreamsInFolder;
  },
});

const blueskyImages = defineCollection({
  schema: BlueskyImageSchema,
  loader: async () => {
    console.log(">> Loading Bluesky Images data");

    if (fs.existsSync(BLUESKY_IMAGES_CACHE_FILE_PATH)) {
      const stats = fs.statSync(BLUESKY_IMAGES_CACHE_FILE_PATH);
      const now = new Date().getTime();
      const cacheAge = now - stats.mtimeMs;

      if (cacheAge < CACHE_DURATION) {
        console.log(`Cache age: ${cacheAge}ms`);
        console.log(`Using cached Bluesky data for content`);

        return JSON.parse(fs.readFileSync(BLUESKY_IMAGES_CACHE_FILE_PATH, "utf-8"));
      }
    }

    const agent = new AtpAgent({
      service: "https://public.api.bsky.app",
    });

    const { data: profileData } = await agent.getProfile({ actor: "meadow.cafe" });

    const allPosts: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;
    while (hasMore) {
      const { data: postsData } = await agent.getAuthorFeed({
        actor: profileData.did,
        filter: "posts_with_media",
        limit: 100,
        cursor: cursor,
      });

      allPosts.push(...postsData.feed.map((f) => f.post));

      cursor = postsData.cursor;
      hasMore = cursor !== undefined;
    }

    console.log(`Got ${allPosts.length} images from Bluesky`);

    // now we want to associate every image with the original post  text, the alt text, and the thumbnail and full images

    const convertedPosts = allPosts
      .map((post) => {
        const uriParts = post.uri.split("/");
        const postId = uriParts[uriParts.length - 1];
        const postUrl = `https://bsky.app/profile/${post.author.did}/post/${postId}`;

        const record: any = post.record;
        const isReplyToAnotherPost = post.record.reply?.parent !== undefined;

        const embedImages: undefined | any[] = record.embed.images;
        const images = !embedImages
          ? undefined
          : embedImages.map((image, imgIdx) => {
              const embedImageData = post.embed?.images?.[imgIdx];

              const { alt, fullsize, thumb, aspectRatio } = embedImageData;

              return {
                alt,
                fullsize,
                thumb,
                aspectRatio: aspectRatio || { width: 16, height: 9 },
              };
            });

        const hashtagsInPost =
          record.facets?.flatMap((facet) => {
            if (facet.features) {
              return facet.features
                .filter((feature) => feature.$type === "app.bsky.richtext.facet#tag")
                .map((feature) => feature.tag);
            }
            return [];
          }) ?? [];

        // we ignore videos for now
        // const embedVideos: undefined | any[] = record.embed.video;
        return {
          id: postId,
          text: record.text,
          createdAt: record.createdAt,
          postUrl,
          images,
          isReplyToAnotherPost,
          hashtagsInPost,
        };
      })
      .filter((post) => {
        const badPostIds = ["3lbrty5hplk2j", "3lc644skrfs2g", "3ljnhw7efyc2c"];

        return !!post.images && !badPostIds.includes(post.id) && !post.hashtagsInPost.includes("meme");
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log("Writing cache file");
    fs.writeFileSync(BLUESKY_IMAGES_CACHE_FILE_PATH, JSON.stringify(convertedPosts));

    return convertedPosts;
  },
});

const historicalNowPages = defineCollection({
  schema: NowPageSchema,
  loader: async () => {
    console.log(">> Loading Historical Now Pages data");

    const nowFilePath = path.join(baseObsidianPath, "Blog/Pages/Now.md");
    const markedParser = new Marked().use(markedFootnote());

    try {
      // Get git log for the Now.md file
      const gitLogOutput = execSync(
        `cd "${baseObsidianPath}" && git log --follow --pretty=format:"%H|%ad|%s" --date=short -- Blog/Pages/Now.md`,
        { encoding: "utf-8" },
      );

      const commits = gitLogOutput
        .trim()
        .split("\n")
        .map((line) => {
          const [hash, date, subject] = line.split("|");
          return { hash, date, subject };
        });

      console.log(`Found ${commits.length} commits for Now.md`);

      // Group commits by date (keep only the latest commit per date)
      const commitsByDate = new Map<string, { hash: string; date: string; subject: string }>();
      commits.forEach((commit) => {
        if (!commitsByDate.has(commit.date)) {
          commitsByDate.set(commit.date, commit);
        }
      });

      console.log(`Found ${commitsByDate.size} unique dates for Now.md`);

      // Get content for each unique date
      const nowPages: Array<{
        id: string;
        title: string;
        slug: string;
        date: Date;
        body: string;
        commitHash: string;
        commitDate: Date;
      }> = [];

      for (const [date, commit] of commitsByDate) {
        try {
          const content = execSync(`cd "${baseObsidianPath}" && git show ${commit.hash}:Brian/Blog/Pages/Now.md`, {
            encoding: "utf-8",
          });

          // Parse the content
          const grayMatterParsed = matter.default(content);

          let body = markedParser.parse(grayMatterParsed.content);
          if (body instanceof Promise) {
            body = await body;
          }

          const parsedDate = new Date(date);
          const slug = date; // Use the date as the slug (YYYY-MM-DD format)

          nowPages.push({
            id: slug,
            title: `Now (${parsedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })})`,
            slug,
            date: parsedDate,
            body,
            commitHash: commit.hash,
            commitDate: parsedDate,
          });
        } catch (error) {
          console.warn(`Failed to get content for commit ${commit.hash} on ${date}:`, (error as Error).message);
        }
      }

      // Sort by date (newest first)
      nowPages.sort((a, b) => b.date.getTime() - a.date.getTime());

      return nowPages;
    } catch (error) {
      console.warn("Failed to load historical now pages:", (error as Error).message);
      return [];
    }
  },
});

export const collections = {
  // 'blog': blogCollection,
  // 'newsletter': newsletter,
  // 'authors': authors,
  blueskyImages,
  obsidianPublishedPosts,
  obsidianPublishedPages,
  obsidianPublishedDreams,
  historicalNowPages,
};
