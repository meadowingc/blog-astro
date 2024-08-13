import { defineConfig } from 'astro/config';
import mdx from "@astrojs/mdx";

// https://docs.astro.build/en/guides/integrations-guide/sitemap/
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: 'https://meadowing.club',
  integrations: [mdx(), sitemap()]
});
