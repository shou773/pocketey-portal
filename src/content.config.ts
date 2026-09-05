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
    eventKey: z.string().optional(),
    reviewStatus: z.enum(['needs-review', 'approved']).optional(),
    sourceLabel: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    japaneseSourceName: z.string().optional(),
    japaneseSourceUrl: z.string().url().optional(),
    japaneseVerificationSummary: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageCredit: z.string().optional(),
    imageSourceUrl: z.string().url().optional(),
    imageLicense: z.string().optional(),
    imageLicenseUrl: z.string().url().optional(),
    imageProvider: z.string().optional(),
    imageContext: z.enum(['illustrative', 'event-specific']).optional(),
    imageStatus: z.enum(['open-license-needs-review', 'needs-ai-fallback', 'approved']).optional(),
    imageGenerated: z.boolean().optional(),
    updated: z.coerce.date().optional(),
    timeSensitive: z.boolean().default(false),
    expiresAt: z.coerce.date().optional()
  })
});

export const collections = { news };
