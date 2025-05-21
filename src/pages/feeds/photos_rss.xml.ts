import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET({ site }) {
  const photos = (await getCollection("blueskyImages"))
    .map((col) => col.data)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return rss({
    title: "Meadow - Photos",
    description: "Photos shared from Bluesky",
    site: site,
    stylesheet: "/rss/pretty-feed-v3.xsl",
    items: photos.map((photo) => ({
      title: photo.text ? photo.text.substring(0, 100) : `Photo from ${photo.createdAt.toLocaleString()}`,
      link: photo.postUrl,
      pubDate: photo.createdAt,
      description: `
        ${photo.text}
        ${photo.images
          .map(
            (image) =>
              `<p><img src="${image.thumb}" alt="${image.alt}" width="${image.aspectRatio.width}" height="${image.aspectRatio.height}" /></p>`,
          )
          .join("")}
      `,
    })),
    customData: `<language>en-us</language>`,
  });
}
