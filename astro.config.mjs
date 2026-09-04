import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.pocketey.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/editorial/')
    })
  ],
  output: 'static'
});
