import { z } from "astro:content";

export type BlueskyImage = z.infer<typeof BlueskyImageSchema>;
export type KittyPost = z.infer<typeof KittyPostSchema>;

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
