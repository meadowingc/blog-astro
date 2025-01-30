import { getCollection } from "astro:content";
import { OGImageRoute } from "astro-og-canvas";

const obsidianPosts = await getCollection("obsidianPublishedPosts");

const pages = obsidianPosts
  .map((pdata) => pdata.data)
  .filter((post) => !post.metaImage?.includes("/open-graph/blog")) // no need to generate OG images for posts that already have one
  .reduce((acc, post) => {
    acc[`blog--${post.slug}`] = {
      title: post.title,
      description: post.body.substring(0, 100),
    };
    return acc;
  }, {});

export const { getStaticPaths, GET } = OGImageRoute({
  // Tell us the name of your dynamic route segment.
  // In this case it’s `route`, because the file is named `[...route].ts`.
  param: "route",

  pages: pages,

  getImageOptions: (path, page) => ({
    title: page.title,
    description: "~ Meadow",
    bgImage: {
      path: "src/assets/images/og-meadow-background-pict.webp",
    },
    padding: 85,
    font: {
      title: {
        // light gray
        color: [0xbb, 0xbb, 0xbb],
        size: 93,
        lineHeight: 0.9,
        families: ["Caveat"],
      },
      description: {
        // dark gray
        color: [0x99, 0x99, 0x99],
        size: 50,
        weight: "Bold",
        lineHeight: 1.7,
        families: ["Caveat"],
      },
    },
    fonts: ["src/assets/fonts/Caveat-VariableFont_wght.ttf"],
  }),
});
