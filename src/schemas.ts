import { z } from "astro:content";

export type BlueskyImage = z.infer<typeof BlueskyImageSchema>;
export type KittyPost = z.infer<typeof KittyPostSchema>;
export type ObsidianPost = z.infer<typeof ObsidianPostSchema>;
export type ObsidianPage = z.infer<typeof ObsidianPageSchema>;

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

export const KittyPostSchema = z.object({
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
});

// {
//   id: file,
//   title: frontMatter.title,
//   slug: frontMatter.slug,
//   publishedAt: frontMatter.publishedAt,
//   tags: frontMatter.tags || [],
//   body: body,
//   metaDescription: frontMatter.metaDescription,
//   metaImage: frontMatter.metaImage,
// };

export const ObsidianPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  filename: z.string(),
  publishedAt: z.coerce.date(),
  tags: z.array(z.string()),
  body: z.string(),
  metaDescription: z.string().optional(),
  metaImage: z.string().optional(),
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

