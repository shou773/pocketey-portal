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

This is not a publish candidate: the user's later four-game music/SFX request
must be completed and independently reviewed before merging or deploying.
