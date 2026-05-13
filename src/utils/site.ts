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
  searchConsoleVerification:
    import.meta.env.PUBLIC_GSC_VERIFICATION ||
    "dI3TAtbUdwdQOWLGwOfcRGYRp2Qgpgkgjok_1XaaQx8",
} as const;

export const FEATURES = {
  blog: false,
} as const;

/**
 * AdSense ad-unit slot IDs. Each AdSlot.astro `slot` prop is looked up here.
 *
 * Add the 10-digit `data-ad-slot` value from AdSense → Ads → By ad unit →
 * Display ads → (your unit) → "<>" code, e.g. `data-ad-slot="1234567890"`.
 *
 * Slots left as empty strings render NOTHING in production (the AdSlot
 * component skips the <ins> entirely), so the site won't ship malformed
 * AdSense tags. In dev the slot still shows a placeholder for visibility.
 *
 * Recommended ad sizing for all slots: Responsive (auto).
 */
export const ADSENSE_SLOTS: Record<string, string> = {
  // Top of the home page — every visitor sees this
  "home-top-banner": "",
  // Bottom of the home page grid (legacy "portal-grid-1" replacement)
  "home-grid-bottom": "",
  // Game detail page — directly above the embedded game (highest CTR position)
  "game-detail-above-game": "",
  // Game detail page — below the game iframe, in the post-play attention area
  "game-detail-below-game": "",
  // Game detail page — bottom of the article (existing GameEmbed-adjacent slot)
  "game-detail-bottom": "",
  // Inside the game iframe at the end-of-run modal (currently unused but
  // wired for future once games are updated to use this slot name)
  "game-end-modal": "",
};

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
