# Four-game release checkpoint

Based on public main `711b53dad512a5c09ac06d564ec5457e554f4ead`.
Pulse Drift (PR #7, `fff466a8f34a0807db08a2d72ec4709396feb9a3`) and TiltTrail
(PR #8, `b9a313e83a8379b5f372f4c1d61ffb2c82a34791`) are integrated in isolation.

Public routes: `/games/pulse-drift/`, `/games/tilttrail/`. Prototype routes have
static Astro redirects and are excluded from the sitemap. Both games have
localized titles/descriptions, canonical URLs and gameplay OG previews.
Home and game listing show four games; About and control instructions describe
all four. Pulse's unavailable-storage notice now survives locale/sound changes.
Orbit/Amber game models, assets, controls and saves are unchanged.

Checkpoint validation: Astro check, game TypeScript check, all model tests and
production build passed. New route/card/metadata tests and wider gameplay tests
are being added. Evidence PNGs are real browser gameplay captures and four-card
portal captures at 320/390/1280px in both languages.

The four-game music/SFX implementation is now populated. See AUDIO.md for
source/codec/mix records. Exact-candidate CI and independent parent review remain
required before merging or deploying.

Final generated-output audit also found missing OG tags on the two existing
ActionGame routes. Both now use the same GameMeta component as the new games,
including JA/EN title/description and canonical/OG image/URL. All four preview
files exist, all four canonicals occur in the sitemap, and only the two prototype
redirect outputs contain refresh tags. Save formats and physics are unchanged. A subsequent small Amber wide-desktop render-buffer adjustment is documented in AUDIO.md; adopted 3D assets remain.
