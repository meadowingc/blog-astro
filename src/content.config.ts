import { AtpAgent } from "@atproto/api";
import { defineCollection, z } from "astro:content";
import fs from "fs";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import os from "os";
import path from "path";
import { BlueskyImageSchema, ObsidianPageSchema, ObsidianPostSchema, type ObsidianPost } from "./schemas";
import * as matter from "gray-matter";
import { DateTime } from "luxon";

const CACHE_DURATION = 5 * 60 * 60 * 1000; // hours in milliseconds
const BLUESKY_IMAGES_CACHE_FILE_PATH = path.join(os.tmpdir(), "AstroBlog__BlueskyImagesCache.json");

// Load all attachments from Obsidian folder _attachments
const baseObsidianPath = path.resolve("../obsidian-brain/Brian/");
const attachmentsFolderPath = path.join(baseObsidianPath, "_attachments");
const publicImagesFolderPath = path.resolve("./public/obsidian_images");

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
      for (const attachmentPath of allKnownAttachments) {
        const attachmentName = path.basename(attachmentPath);
        if (grayMatterParsed.content.includes(attachmentName)) {
          grayMatterParsed.content = grayMatterParsed.content.replace(
            attachmentName,
            `/obsidian_images/${attachmentName}`,
          );
          copyImageToPublicFolder(attachmentPath);
        }
      }

      // Convert wikilinks to markdown links
      grayMatterParsed.content = grayMatterParsed.content.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
        return `<div class="obsidian-image"><img src="${p1}" alt="${p1}" /></div>`;
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
        function convertToSlug(Text) {
          return Text.toLowerCase()
            .replace(/[^\w ]+/g, "")
            .replace(/ +/g, "-");
        }

        frontMatter.slug = convertToSlug(frontMatter.title);
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

    return (await loadDataPostsInFolder("Blog/Published", true))
      .filter((post) => post.publishedAt <= now)
      .map((post) => {
        post.tags ||= [];
        return post;
      })
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  },
});

const obsidianPublishedPages = defineCollection({
  schema: ObsidianPageSchema,
  loader: async () => {
    console.log(">> Loading Obsidian Published Pages data");
    return await loadDataPostsInFolder("Blog/Pages", false);
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
        const postUrl = `https://bsky.app/profile/meadow.cafe/post/${postId}`;

        const record: any = post.record;
        const isReplyToAnotherPost = post.record.reply?.parent !== undefined;

        const embedImages: undefined | any[] = record.embed.images;
        const images = !embedImages
          ? undefined
          : embedImages.map((image, imgIdx) => {
              const { alt, fullsize, thumb, aspectRatio } = post.embed?.images?.[imgIdx];

              return {
                alt,
                fullsize,
                thumb,
                aspectRatio,
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
        const badPostIds = ["3lbrty5hplk2j", "3lc644skrfs2g"];

        return !!post.images && !badPostIds.includes(post.id) && !post.hashtagsInPost.includes("meme");
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log("Writing cache file");
    fs.writeFileSync(BLUESKY_IMAGES_CACHE_FILE_PATH, JSON.stringify(convertedPosts));

    return convertedPosts;
  },
});

export const collections = {
  // 'blog': blogCollection,
  // 'newsletter': newsletter,
  // 'authors': authors,
  blueskyImages,
  obsidianPublishedPosts,
  obsidianPublishedPages,
};
