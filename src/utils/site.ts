/**
 * Site-wide constants and helpers used by SEO, OGP, RSS and the import script.
 * Single source of truth for the site brand and URL.
 */
export const SITE = {
  name: "Pocketey",
  tagline: "1-Minute 3D Browser Games",
  description:
    "Hand-crafted 3D browser games made for your phone. Tap, swipe, pop — every game runs portrait, in your browser, in under 3 minutes.",
  url: (
    import.meta.env.PUBLIC_SITE_URL || "https://pocketey.com"
  ).replace(/\/$/, ""),
  defaultOgImage: "/og-default.png",
  twitter: "@pocketey",
  locale: "en",
  adsenseId:
    import.meta.env.PUBLIC_ADSENSE_ID || "ca-pub-3863821336817317",
} as const;

export const FEATURES = {
  blog: false,
} as const;

export function absoluteUrl(path: string): string {
  if (/^https?:/i.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function gameUrl(slug: string): string {
  return `/games/${slug}/`;
}

export function gamePlayUrl(slug: string): string {
  return `/games/${slug}/play/`;
}

export function gameAssetUrl(slug: string, file: string): string {
  return `/games/${slug}/${file}`;
}
