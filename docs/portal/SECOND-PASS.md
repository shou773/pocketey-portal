# Second portal proposal: a shelf of four game covers

Latest visual refinement: [original cover titles and stronger protagonist composition](TITLE-PASS.md). The images below record the earlier ff1f191 proposal for comparison.

Base: `8714b3f7724df370326a45a615ca98e21f5607da`. Branch: `design/arcade-second-pass`. Draft visual review only; merge and deployment are not authorized yet.

The published first proposal gave text and repeated controls priority over game images. At 1440px the first image began at y398; at 390px Japanese it began at y462. Three desktop thumbnails were only 239px wide, while the four games appeared three times as pills, image cards and description cards. The screenshots reduced already small player models and included HUD text in TiltTrail. The second proposal addresses composition before further CSS polish.

## Images first

Four new introduction covers use the actual game models, authored geometry and existing licensed assets. These are staged illustrations, not actual play screenshots. Their alternate text says they are composed covers, and no in-game-view badge is displayed. No game features, extra games, ratings, users or popularity claims are invented.

- Orbit: foreground ship, angled runway and a nearby obstacle.
- Amber: the existing character in an airborne pose between thick sandstone platforms, with a three-quarter view of the face.
- Pulse: the existing white-blue ship, incoming enemies and red projectiles in the published canyon/water setting. The collision indicator is omitted from the illustration, rather than implying a different game interface.
- Tilt: the striped ball and actual turning road, with an existing observatory and its island arranged into the background of the cover.

Sources and presentation choices are pinned in [cover provenance](../../public/games/covers/SOURCES.json). Orbit, Amber and Tilt use the separately reviewed art branches at their recorded SHAs. Those renderer changes are not in this PR, and alignment with published game art is required before this proposal can be published. Pulse uses current published main. These covers do not claim a performance improvement or represent an ordinary-input game test.

## Quiet shelf

The portal starts with a compact, bold lowercase Pocketey wordmark and four equal image cards in two columns, including on mobile. Genre tags, promotion headlines, quick-pick pills and repeated description cards are removed. Each card contains its cover, readable game name and play link. Each game’s detailed instructions remain on its own route. Existing controls, stage-unlock explanation, local progress, device requirements and troubleshooting are retained in a collapsible help section. The controls link opens that section. Information pages and the contact integration retain their established routes and language behavior.

## First-review evidence

- [Desktop before/after comparison](evidence/second-pass/comparison-desktop.png)
- [Mobile before/after comparison](evidence/second-pass/comparison-mobile.png)
- [Four covers and 200px samples](evidence/second-pass/cover-sheet.png)
- [Desktop, 1440 × 900](evidence/second-pass/after-desktop-ja.png)
- [Mobile, 390 × 844](evidence/second-pass/after-mobile-ja.png)
- [320px](evidence/second-pass/after-small-en.png)
- [Recorded layout measurements](evidence/second-pass/geometry.json)

At 1440 × 900, images begin at approximately y111 and all four complete cards are visible. At 390 × 844, images begin at approximately y103 and all four complete cards are visible. Images occupy approximately 86% of desktop cards and 73% of mobile cards. Both languages were captured, with no horizontal overflow. The small-size contact sheet is for visual assessment, not an automatic claim that subjective quality is accepted.

Build and Astro check pass (0 errors, 0 warnings, 6 existing hints). Four light portal checks pass: both languages/routes across 320–1440px, keyboard navigation, caption/play contrast, and English/Japanese navigation and retention. Existing presentation tests were adapted from the removed pills to the cover links and the concise Games heading. The [build log](evidence/second-pass/build.log), [Astro check log](evidence/second-pass/astro-check.log), [four-check smoke log](evidence/second-pass/portal-smoke.log) and [help-link check](evidence/second-pass/help-check.json) are included. Long gameplay CI was not run. Wider regression checking follows review of the covers and layout.

Game runtime, individual game routes, physics, audio, saves, dependencies, CI and hosting are untouched. No Library save was retried after the earlier authentication refusal.
