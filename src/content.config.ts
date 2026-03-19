import { AtpAgent } from "@atproto/api";
import { defineCollection } from "astro:content";
import fs from "fs";
import * as matter from "gray-matter";
import { JSDOM } from "jsdom";
import { DateTime } from "luxon";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import os from "os";

import path from "path";
import { BacklinkEntrySchema, BlueskyImageSchema, NowPageSchema, ObsidianDreamSchema, ObsidianPageSchema, ObsidianPostSchema } from "./schemas";

const CACHE_DURATION = 5 * 60 * 60 * 1000; // hours in milliseconds
const BLUESKY_IMAGES_CACHE_FILE_PATH = path.join(os.tmpdir(), "AstroBlog__BlueskyImagesCache.json");

const BLUESKY_MAX_RETRIES = 3;
const BLUESKY_INITIAL_DELAY_MS = 1000;

/**
 * Retry wrapper with exponential backoff for async operations.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = BLUESKY_MAX_RETRIES,
  initialDelayMs = BLUESKY_INITIAL_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        console.error(`${operationName} failed after ${maxRetries} attempts:`, lastError.message);
        throw lastError;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`${operationName} attempt ${attempt}/${maxRetries} failed: ${lastError.message}. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// Load all attachments from Obsidian folder _attachments
const baseObsidianPath = path.resolve("../obsidian-brain/Brian/");
const attachmentsFolderPath = path.join(baseObsidianPath, "_attachments");
const publicImagesFolderPath = path.resolve("./public/obsidian_images");

// Load TTS audio manifest (maps post filename stems to remote audio URLs)
const TTS_MANIFEST_URL = "https://post-audios.meadow.cafe/manifest.json";
let _ttsAudioManifest: Record<string, { audioFile: string; audioUrl: string }> | null = null;

async function getTtsAudioManifest(): Promise<Record<string, { audioFile: string; audioUrl: string }>> {
  if (_ttsAudioManifest) return _ttsAudioManifest;
  try {
    const response = await fetch(TTS_MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    _ttsAudioManifest = await response.json() as Record<string, { audioFile: string; audioUrl: string }>;
  } catch (error) {
    console.warn(`Failed to fetch TTS manifest from ${TTS_MANIFEST_URL}: ${(error as Error).message}`);
    _ttsAudioManifest = {};
  }
  return _ttsAudioManifest;
}

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

/**
 * Wraps consecutive obsidian-image divs (2 or more) in a gallery container
 * for masonry layout display. Uses DOM parsing for robustness.
 */
function wrapConsecutiveImagesInGallery(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const document = dom.window.document;
  const body = document.body;

  // Find all obsidian-image divs
  const imageElements = Array.from(body.querySelectorAll<Element>('.obsidian-image'));

  // Group consecutive images
  const processedImages = new Set<Element>();

  for (const img of imageElements as Element[]) {
    if (processedImages.has(img)) continue;

    // Collect consecutive images starting from this one
    const consecutiveImages: Element[] = [img];
    let nextSibling = img.nextSibling;

    while (nextSibling) {
      // Skip whitespace-only text nodes
      if (nextSibling.nodeType === 3 && nextSibling.textContent?.trim() === '') {
        nextSibling = nextSibling.nextSibling;
        continue;
      }

      // Check if it's another obsidian-image
      if (nextSibling.nodeType === 1 && (nextSibling as Element).classList?.contains('obsidian-image')) {
        consecutiveImages.push(nextSibling as Element);
        nextSibling = nextSibling.nextSibling;
        continue;
      }

      // Any other element breaks the sequence
      break;
    }

    // If we have 2+ consecutive images, wrap them in a gallery
    if (consecutiveImages.length >= 2) {
      const gallery = document.createElement('div');
      gallery.className = 'image-gallery';

      // Insert gallery before the first image
      consecutiveImages[0].parentNode?.insertBefore(gallery, consecutiveImages[0]);

      // Move all consecutive images into the gallery
      for (const imgEl of consecutiveImages) {
        gallery.appendChild(imgEl);
        processedImages.add(imgEl);
      }
    }
  }

  return body.innerHTML;
}

async function loadDataPostsInFolder(
  folderPath: string,
  needsPublishedDate: boolean,
): Promise<{ id: string; body: string;[key: string]: any }[]> {
  const actualFolderPath = path.resolve(path.join(baseObsidianPath, folderPath));
  const markdownFiles = fs.readdirSync(actualFolderPath).filter((file) => file.endsWith(".md"));

  console.log(`Found ${markdownFiles.length} markdown files under Obsidian folder: ${folderPath}`);

  const markedParser = new Marked().use(markedFootnote());
  const ttsAudioManifest = await getTtsAudioManifest();

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

      // Wrap consecutive images in a gallery container
      body = wrapConsecutiveImagesInGallery(body);

      // wallback title
      frontMatter.title ||= file.replace(/\.md$/, "");

      if (needsPublishedDate || frontMatter.publishedAt) {
        if (!frontMatter.publishedAt) {
          throw new Error(`Item '${file}' does not have a publishedAt date!`);
        }

        // gray-matter may auto-parse some date formats to Date objects
        if (frontMatter.publishedAt instanceof Date) {
          // Already a Date, keep it as-is
        } else {
          const publishedAtStr = String(frontMatter.publishedAt).trim().replace("−", "-");

          const dateWithOffset = publishedAtStr.substring(0, publishedAtStr.lastIndexOf(" "));
          let zoneOffset = publishedAtStr.substring(publishedAtStr.lastIndexOf(" ") + 1).replace("GMT", "UTC");

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
              `Invalid PublishedDate format for post with title "${frontMatter.title}": "${publishedAtStr}"`,
            );
          }

          frontMatter.publishedAt = parsedDate.toJSDate();
        }
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

      // Set audio version from TTS manifest
      const ttsEntry = ttsAudioManifest[file.replace(/\.md$/, "")];
      frontMatter.audioVersion = ttsEntry?.audioUrl || undefined;

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

    const regularPosts = (await loadDataPostsInFolder("Blog/Published", true))
      .filter((post) => post.publishedAt <= now)
      .map((post) => {
        post.tags ||= [];
        post.metaImage ||= `https://meadow.cafe/open-graph/blog--${post.slug}.png`;
        return post;
      });

    // Load vomits and merge them into posts with a "vomit" tag
    const vomitPosts = (await loadDataPostsInFolder("Blog/Vomits", false))
      .filter((vomit) => !vomit.filename.startsWith("_")) // ignore drafts
      .filter((vomit) => vomit.publishedAt) // only include those with publishedAt
      .filter((vomit) => vomit.publishedAt <= now) // only include published ones
      .map((vomit) => {
        vomit.tags = ["wordvomit"];
        vomit.metaImage ||= `https://meadow.cafe/open-graph/blog--${vomit.slug}.png`;
        return vomit;
      });

    const posts = [...regularPosts, ...vomitPosts]
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

    const { data: profileData } = await withRetry(
      () => agent.getProfile({ actor: "meadow.cafe" }),
      "Bluesky getProfile"
    );

    const allPosts: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;
    while (hasMore) {
      const { data: postsData } = await withRetry(
        () => agent.getAuthorFeed({
          actor: profileData.did,
          filter: "posts_with_media",
          limit: 100,
          cursor: cursor,
        }),
        "Bluesky getAuthorFeed"
      );

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
    console.log(">> Loading Now Pages");

    const nowFolderPath = path.join(baseObsidianPath, "Blog/Pages/Now");
    const markedParser = new Marked().use(markedFootnote());

    try {
      // Read all .md files from the Now folder
      const files = fs.readdirSync(nowFolderPath)
        .filter(file => file.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(file));

      console.log(`Found ${files.length} now page files`);

      const nowPages: Array<{
        id: string;
        title: string;
        slug: string;
        date: Date;
        body: string;
      }> = [];

      for (const file of files) {
        try {
          const filePath = path.join(nowFolderPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');

          // Parse the content
          const grayMatterParsed = matter.default(content);

          let body = markedParser.parse(grayMatterParsed.content);
          if (body instanceof Promise) {
            body = await body;
          }

          // Extract date from filename (YYYY-MM-DD.md)
          const slug = file.replace('.md', '');
          // Parse as local date to avoid timezone issues
          const [year, month, day] = slug.split('-').map(Number);
          const parsedDate = new Date(year, month - 1, day);

          nowPages.push({
            id: slug,
            title: `Now (${parsedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Costa_Rica" })})`,

            slug,
            date: parsedDate,
            body,
          });
        } catch (error) {
          console.warn(`Failed to process now page ${file}:`, (error as Error).message);
        }
      }

      // Sort by date (newest first)
      nowPages.sort((a, b) => b.date.getTime() - a.date.getTime());

      console.log(`Successfully loaded ${nowPages.length} now pages`);

      return nowPages;
    } catch (error) {
      console.warn("Failed to load historical now pages:", (error as Error).message);
      return [];
    }
  },
});

const SITE_BASE_URL = "https://meadow.cafe";

/**
 * Normalizes a URL to a relative path.
 * Handles both absolute URLs (https://meadow.cafe/...) and relative paths (/...).
 */
function normalizeInternalLink(href: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
    return null;
  }

  // Handle absolute URLs to our site - strip the domain
  if (href.startsWith(SITE_BASE_URL)) {
    return href.slice(SITE_BASE_URL.length) || "/";
  }

  // Handle relative paths
  if (href.startsWith("/")) {
    return href;
  }

  // External link
  return null;
}

/**
 * Extracts all internal links from HTML content.
 */
function extractInternalLinks(html: string): string[] {
  const dom = new JSDOM(`<body>${html}</body>`);
  const document = dom.window.document;
  const links = document.querySelectorAll("a[href]");

  const internalPaths = new Set<string>();

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;

    const normalizedPath = normalizeInternalLink(href);
    if (normalizedPath) {
      // Remove trailing slash for consistency (except for root)
      const cleanPath = normalizedPath === "/" ? "/" : normalizedPath.replace(/\/$/, "");
      internalPaths.add(cleanPath);
    }
  }

  return Array.from(internalPaths);
}

interface LinkablePage {
  slug: string;
  title: string;
  path: string;
  body: string;
  type: "post" | "dream" | "page" | "now";
}

interface Backlink {
  slug: string;
  title: string;
  path: string;
  type: "post" | "dream" | "page" | "now";
}

/**
 * Builds backlinks by analyzing all pages and finding which pages link to each other.
 */
function buildBacklinksMap(pages: LinkablePage[]): Map<string, Backlink[]> {
  const backlinksMap = new Map<string, Backlink[]>();

  // Initialize empty arrays for all pages
  for (const page of pages) {
    const cleanPath = page.path === "/" ? "/" : page.path.replace(/\/$/, "");
    backlinksMap.set(cleanPath, []);
  }

  // For each page, find what it links to and add backlinks
  for (const sourcePage of pages) {
    const linksInPage = extractInternalLinks(sourcePage.body);

    for (const linkPath of linksInPage) {
      // Find the target page
      const targetPage = pages.find((p) => {
        const cleanLinkPath = linkPath === "/" ? "/" : linkPath.replace(/\/$/, "");
        const cleanPagePath = p.path === "/" ? "/" : p.path.replace(/\/$/, "");
        return cleanLinkPath === cleanPagePath;
      });

      if (targetPage && targetPage.path !== sourcePage.path) {
        const targetKey = targetPage.path === "/" ? "/" : targetPage.path.replace(/\/$/, "");
        const backlinks = backlinksMap.get(targetKey) || [];

        // Check if this backlink already exists
        const exists = backlinks.some((bl) => bl.path === sourcePage.path);
        if (!exists) {
          backlinks.push({
            slug: sourcePage.slug,
            title: sourcePage.title,
            path: sourcePage.path,
            type: sourcePage.type,
          });
        }

        backlinksMap.set(targetKey, backlinks);
      }
    }
  }

  return backlinksMap;
}

// Store loaded data to share between collections
let cachedPosts: any[] | null = null;
let cachedDreams: any[] | null = null;
let cachedPages: any[] | null = null;
let cachedNowPages: any[] | null = null;

const backlinks = defineCollection({
  schema: BacklinkEntrySchema,
  loader: async () => {
    console.log(">> Computing Backlinks");

    // Load all content (reuse cached data if available from other collections)
    const now = new Date();

    // Load posts
    if (!cachedPosts) {
      const regularPosts = (await loadDataPostsInFolder("Blog/Published", true))
        .filter((post) => post.publishedAt <= now)
        .map((post) => {
          post.tags ||= [];
          post.metaImage ||= `https://meadow.cafe/open-graph/blog--${post.slug}.png`;
          return post;
        });

      const vomitPosts = (await loadDataPostsInFolder("Blog/Vomits", false))
        .filter((vomit) => !vomit.filename.startsWith("_"))
        .filter((vomit) => vomit.publishedAt)
        .filter((vomit) => vomit.publishedAt <= now)
        .map((vomit) => {
          vomit.tags = ["wordvomit"];
          vomit.metaImage ||= `https://meadow.cafe/open-graph/blog--${vomit.slug}.png`;
          return vomit;
        });

      cachedPosts = [...regularPosts, ...vomitPosts];
    }

    // Load dreams
    if (!cachedDreams) {
      cachedDreams = (await loadDataPostsInFolder("Blog/Dreams", false))
        .filter((dream) => dream.publishedAt);
    }

    // Load pages
    if (!cachedPages) {
      cachedPages = await loadDataPostsInFolder("Blog/Pages", false);
    }

    // Load now pages
    if (!cachedNowPages) {
      const nowFolderPath = path.join(baseObsidianPath, "Blog/Pages/Now");
      const markedParser = new Marked().use(markedFootnote());
      try {
        const files = fs.readdirSync(nowFolderPath)
          .filter(file => file.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(file));

        cachedNowPages = [];
        for (const file of files) {
          try {
            const filePath = path.join(nowFolderPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const grayMatterParsed = matter.default(content);

            let body = markedParser.parse(grayMatterParsed.content);
            if (body instanceof Promise) {
              body = await body;
            }

            const slug = file.replace('.md', '');
            const [year, month, day] = slug.split('-').map(Number);
            const parsedDate = new Date(year, month - 1, day);

            cachedNowPages.push({
              id: slug,
              title: `Now (${parsedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Costa_Rica" })})`,
              slug,
              date: parsedDate,
              body,
            });
          } catch (error) {
            console.warn(`Failed to process now page ${file}:`, (error as Error).message);
          }
        }
      } catch (error) {
        console.warn("Failed to load now pages for backlinks:", (error as Error).message);
        cachedNowPages = [];
      }
    }

    // Build linkable pages array
    const linkablePages: LinkablePage[] = [
      ...cachedPosts.map((p) => ({
        slug: p.slug,
        title: p.title,
        path: `/blog/${p.slug}`,
        body: p.body,
        type: "post" as const,
      })),
      ...cachedDreams.map((d) => ({
        slug: d.slug,
        title: d.title,
        path: `/dreams/${d.slug}`,
        body: d.body,
        type: "dream" as const,
      })),
      ...cachedPages.map((p) => ({
        slug: p.slug,
        title: p.title,
        path: `/${p.slug}`,
        body: p.body,
        type: "page" as const,
      })),
      ...cachedNowPages.map((n) => ({
        slug: n.slug,
        title: n.title,
        path: `/now/${n.slug}`,
        body: n.body,
        type: "now" as const,
      })),
    ];

    // Build backlinks map
    const backlinksMap = buildBacklinksMap(linkablePages);

    // Convert map to collection entries
    const entries: Array<{ id: string; backlinks: Backlink[] }> = [];
    for (const [pagePath, pageBacklinks] of backlinksMap) {
      entries.push({
        id: pagePath,
        backlinks: pageBacklinks,
      });
    }

    console.log(`Computed backlinks for ${entries.length} pages`);

    return entries;
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
  backlinks,
};
