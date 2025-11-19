import { z } from "astro:content";

export type BlueskyImage = z.infer<typeof BlueskyImageSchema>;
export type ObsidianPost = z.infer<typeof ObsidianPostSchema>;
export type ObsidianPage = z.infer<typeof ObsidianPageSchema>;
export type ObsidianDream = z.infer<typeof ObsidianDreamSchema>;
export type NowPage = z.infer<typeof NowPageSchema>;

export const BlueskyImageSchema = z.object({
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
});

export const ObsidianPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  filename: z.string(),
  publishedAt: z.coerce.date(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()),
  body: z.string(),
  metaDescription: z.string().optional(),
  metaImage: z.string().optional(),
  audioVersion: z.string().optional(),
});

export const ObsidianPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  filename: z.string(),
  body: z.string(),
  metaDescription: z.string().optional(),
  metaImage: z.string().optional(),
});

export const ObsidianDreamSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  filename: z.string(),
  publishedAt: z.coerce.date(),
  body: z.string(),
  metaDescription: z.string().optional(),
  metaImage: z.string().optional(),
  audioVersion: z.string().optional(),
});

export const NowPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  date: z.coerce.date(),
  body: z.string(),
});
