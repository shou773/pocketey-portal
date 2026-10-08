import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.pocketey.com',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes('/prototypes/')
    })
  ],
  redirects: { '/prototypes/pulse-drift': '/games/pulse-drift/', '/games/prototypes/tilttrail': '/games/tilttrail/' },
  output: 'static'
});
