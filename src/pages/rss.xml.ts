import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE, FEATURES, gameUrl } from "@utils/site";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const games = await getCollection("games");
  const blog = FEATURES.blog
    ? (await getCollection("blog")).filter((p) => !p.data.draft)
    : [];

  const items = [
    ...games.map((g) => ({
      title: g.data.title,
      description: g.data.tagline,
      pubDate: new Date(g.data.releaseDate),
      link: gameUrl(g.data.slug),
    })),
    ...blog.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.publishDate,
      link: `/blog/${p.id}/`,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items,
    customData: `<language>en-us</language>`,
  });
}
