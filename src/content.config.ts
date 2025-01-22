import { AtpAgent } from "@atproto/api";
import { defineCollection, z } from "astro:content";
import fs from "fs";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import os from "os";
import path from "path";

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const KITTY_CACHE_FILE_PATH = path.join(os.tmpdir(), "AstroBlog__KittyPostsCache.json");
const BLUESKY_IMAGES_CACHE_FILE_PATH = path.join(os.tmpdir(), "AstroBlog__BlueskyImagesCache.json");

const blueskyImages = defineCollection({
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

        // we ignore videos for now
        // const embedVideos: undefined | any[] = record.embed.video;

        return {
          id: postId,
          text: record.text,
          createdAt: record.createdAt,
          postUrl,
          images,
          isReplyToAnotherPost,
        };
      })
      .filter((post) => {
        const badPostIds = ["3lbrty5hplk2j", "3lc644skrfs2g"];

        return !!post.images && !badPostIds.includes(post.id);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log("Writing cache file");
    fs.writeFileSync(BLUESKY_IMAGES_CACHE_FILE_PATH, JSON.stringify(convertedPosts));

    return convertedPosts;
  },
  schema: z.object({
    id: z.string(),
    text: z.string(),
    postUrl: z.string(),
    createdAt: z.coerce.date(),
    isReplyToAnotherPost: z.boolean(),
    images: z.array(
      z.object({
        alt: z.string(),
        fullsize: z.string(),
        thumb: z.string(),
        aspectRatio: z.object({
          width: z.number(),
          height: z.number(),
        }),
      }),
    ),
  }),
});

const kittyPosts = defineCollection({
  loader: async () => {
    console.log(">> Loading Kitty data");

    if (fs.existsSync(KITTY_CACHE_FILE_PATH)) {
      const stats = fs.statSync(KITTY_CACHE_FILE_PATH);
      const now = new Date().getTime();
      const cacheAge = now - stats.mtimeMs;

      if (cacheAge < CACHE_DURATION) {
        console.log(`Cache age: ${cacheAge}ms`);
        console.log(`Using cached Bluesky data for content`);

        return JSON.parse(fs.readFileSync(KITTY_CACHE_FILE_PATH, "utf-8"));
      }
    }

    const data = await fetch("https://kitty.meadow.cafe/api/v1/get-user-posts-messages/1");

    const allPages = (await data.json())
      .filter((page) => page.Slug)
      .map((page) => {
        const markedParser = new Marked().use(markedFootnote());

        page.ID = page.ID.toString();
        page.id = page.ID;

        page.Body = markedParser.parse(page.Body);

        return page;
      });

    const slugToPage = allPages.reduce((acc, page) => {
      acc[page.Slug] = page;
      return acc;
    }, {});

    const pagesWithProperLinks = allPages.map((page) => {
      const linkPattern = /href="\/([^"]+)"/g;

      page.Body = page.Body.replace(linkPattern, (match, slug) => {
        slug = slug.replace(/\/$/, "");
        if (slugToPage[slug] && !slugToPage[slug]["is page"]) {
          return `href="/blog/${slug}"`;
        }
        return match;
      });

      return page;
    });

    console.log(`Loaded ${pagesWithProperLinks.length} pages from Kitty`);

    console.log("Writing cache file");
    fs.writeFileSync(KITTY_CACHE_FILE_PATH, JSON.stringify(pagesWithProperLinks));

    return pagesWithProperLinks;
  },
  schema: z.object({
    ID: z.string(),
    CreatedAt: z.coerce.date(),
    UpdatedAt: z.coerce.date(),
    DeletedAt: z.coerce.date().optional(),
    AdminUserID: z.number(),
    Title: z.string(),
    Body: z.string(),
    Slug: z.string(),
    PublishedDate: z.coerce.date().optional(),
    IsPage: z.boolean(),
    MetaDescription: z.string().optional(),
    MetaImage: z.string().optional(),
    Lang: z.string(),
    Tags: z.array(z.string()),
    Published: z.boolean(),
  }),
});

export const collections = {
  // 'blog': blogCollection,
  // 'newsletter': newsletter,
  // 'authors': authors,
  kittyPosts,
  blueskyImages,
};
