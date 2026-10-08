# Rich arcade portal candidate

Base: `a443ec37c33cae22021c82b7b20f3fb6e62f02c6`. Branch: `design/rich-games-portal`.

The home and all-games routes now present four original games in a dark, compact arcade. On desktop Orbit Ribbon has a larger lead card, with three horizontal cards alongside it. This is a composition choice, not a popularity claim. At 760px and below the games become two equal columns, and at 520px and below a single column. Four direct game links remain near the top in both languages, including at 320px, so the introduction does not prevent choosing any game. Below the image cards, each game has its existing detailed explanation and stages, followed by controls, storage and troubleshooting information.

The direction incorporates the parent's visual research of [CrazyGames](https://www.crazygames.com/), [Poki](https://poki.com/) and [AMIX GAMES](https://amix-design.com/tl/web-g-games/): prioritize game images, keep selection simple and show each game's identity. The UI is Pocketey's own typography, spacing, card composition and mint/amber/blue/green accents. All thumbnails are the four existing actual-game PNGs; no other site's artwork or branding is included. These thumbnails must be refreshed against the published renderers when the parallel game-art changes ship.

Only the two portal routes opt into `body.portal-page`. The existing light styling remains available for information pages. Existing language selection, canonical metadata, controls copy, footer destinations and contact integration are retained. The game renderers, shared audio, physics, saves, dependencies, CI and hosting are not changed.

## Visual review

Before images use an isolated archive of the base commit. After images use the production build. Chromium captures use the same viewport and Japanese language for side-by-side comparisons. The Astro development toolbar was hidden for baseline captures.

- [Desktop comparison, 1440 × 1000 source viewports](evidence/rich-arcade/comparison-desktop.png)
- [Mobile comparison, 390 × 844](evidence/rich-arcade/comparison-mobile.png)
- [320px viewport](evidence/rich-arcade/after-small-viewport.png)
- [Desktop full page, Japanese](evidence/rich-arcade/after-desktop-ja.png) / [English](evidence/rich-arcade/after-desktop-en.png)
- [Mobile full page, Japanese](evidence/rich-arcade/after-mobile-ja.png) / [English](evidence/rich-arcade/after-mobile-en.png)

## Validation

- `ASTRO_TELEMETRY_DISABLED=1 npm run build`: pass, including existing public-route and retired-route guards.
- `ASTRO_TELEMETRY_DISABLED=1 npm run check`: 0 errors, 0 warnings; 6 existing hints.
- Production-preview portal subset: **16 passed**, including 3 new design checks. Evidence: [test log](evidence/rich-arcade/portal-tests.log), [build log](evidence/rich-arcade/build.log), [Astro check log](evidence/rich-arcade/astro-check.log).
- Both portal routes, JA and EN, at 320, 390, 600, 760, 1024 and 1440px: no horizontal overflow; four visible direct game links; actual thumbnail loading; play target heights at least 42px.
- Keyboard skip link and focused game-link activation preserve Japanese. CSS exposes a visible mint focus outline and honors reduced motion.
- All sampled card titles, genre labels, taglines, facts, play buttons, descriptions and stage names pass 4.5:1 contrast against their card/background colors. The contrast test uses the lighter end of the page gradient and the card surface colors.
- Existing tests verify language priority, retention and unavailable storage, all internal information links in both languages, 404/sitemap behavior, mocked contact success/failure, blocked challenge handling, translated unsupported WebGL exits and public metadata for all four games. Real contact messages are not sent.
- Long full-stage gameplay tests were deliberately excluded from this presentation-only change. Initial runs against Astro's development server encountered dev-only metadata timing and missing generated sitemap; the final reported results are against the production build.

Reproduce the selected browser suite:

```sh
npm run test:portal -- --grep 'all four games stay|keyboard navigation exposes|portal text and play|English default|Japanese browser|blocked or corrupt|retired URLs|current pages|contact|unsupported WebGL|public metadata|retired prototypes'
```

Merge and deployment remain pending parent approval. Thumbnail alignment with new game artwork is pending those games' publication; this candidate accurately uses the current published art.
