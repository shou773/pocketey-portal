import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(['Travel Updates', 'Transportation', 'Events', 'Weather & Disruptions', 'Travel Guides']),
    location: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    sourceLabel: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    updated: z.coerce.date().optional()
  })
});

export const collections = { news };
