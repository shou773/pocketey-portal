import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Game metadata collection. The Zod schema mirrors SHARED_SPEC §4
 * so any imported game.json that violates the contract fails the build.
 */
const games = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/games",
    generateId: ({ entry }) => entry.replace(/\.json$/, ""),
  }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(80),
    tagline: z.string().min(1).max(120),
    description: z.string().min(120).max(2000),
    category: z.enum(["puzzle", "action", "idle", "casual", "experimental"]),
    tags: z.array(z.string()).default([]),
    thumbnail: z.string(),
    ogImage: z.string().optional(),
    playUrl: z.string(),
    controls: z.object({
      en: z.string(),
      ja: z.string().optional(),
    }),
    playTime: z.enum(["30s", "1-3min", "3-10min", "10min+"]),
    orientation: z.enum(["portrait", "landscape", "both"]),
    platforms: z
      .array(z.enum(["mobile-web", "desktop-web"]))
      .default(["mobile-web", "desktop-web"]),
    languages: z.array(z.string()).default(["en"]),
    releaseDate: z.string(),
    version: z.string(),
    featured: z.boolean().default(false),
    longTailKeyword: z.string().optional(),
    engineNotes: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/blog",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    relatedGames: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { games, blog };
