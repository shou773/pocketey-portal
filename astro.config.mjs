// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { FEATURES } from './src/utils/site.ts';

const SITE = process.env.PUBLIC_SITE_URL || 'https://pocketey.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap({
      filter: (page) => (FEATURES.blog ? true : !/\/blog(\/|$)/.test(page)),
    }),
  ],
});
