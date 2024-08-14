import { z, defineCollection } from "astro:content";

// const blogCollection = defineCollection({
//   type: 'content',
//   schema: z.object({ /* ... */ })
// });
// const newsletter = defineCollection({
//   type: 'content',
//   schema: z.object({ /* ... */ })
// });
const bear_export = defineCollection({
  type: "data",
  schema: z.object({
    ID: z.string(),
    blog_id: z.string(),
    uid: z.string(),
    title: z.string(),
    slug: z.string(),
    alias: z.string().optional(),
    "published date": z.string().datetime(),
    "last modified": z.string().datetime(),
    "all tags": z.array(z.string()),
    publish: z.boolean(),
    "make discoverable": z.boolean(),
    "is page": z.boolean(),
    content: z.string(),
    "canonical url": z.string().optional(),
    "meta description": z.string().optional(),
    "meta image": z.string().optional(),
    lang: z.string().optional(),
    "class name": z.string().optional(),
    "first published at": z.string().datetime(),
    upvotes: z.string(),
    "shadow votes": z.string(),
    score: z.string(),
    hidden: z.boolean(),
    pinned: z.boolean(),
  }),
});

export const collections = {
  // 'blog': blogCollection,
  // 'newsletter': newsletter,
  // 'authors': authors,
  bear_export,
};
