# Mobile UI refresh — review pending

Base: `dce870df42138a03718359149bede54f72d600e3`. Branch: `codex/game-ui-refresh`. Do not merge before the parent's independent visual review.

## Actual third-party artwork

13 original Lucide SVG files are served locally from `public/games/assets/lucide/`, pinned to upstream **b56741cf30c08fc7248bf41ddd3a261367aa9579**. [Official repository](https://github.com/lucide-icons/lucide) and [exact license](https://github.com/lucide-icons/lucide/blob/b56741cf30c08fc7248bf41ddd3a261367aa9579/LICENSE). Lucide grants ISC permission; the selected Feather-derived arrows/check also carry MIT terms. The complete ISC/MIT copyright and permission notices are shipped as `LICENSE.txt`, linked from each game's menu. `SOURCES.json` records every source URL, original byte count and SHA-256. SVG paths are unmodified; CSS masks provide theme colors. No icon font, dependency or runtime CDN was added.

Usage: orbit/gem introduction emblems; trophy on clear; rotate-ccw on retry; sparkles on pause; flag/lock/check stage states; play in primary actions; footprints/orbit instructions; three arrow assets in touch controls. This is actual external artwork, not a claim that CSS alone constitutes material adoption. Original SVGs total **4,816 bytes**; license **3,208 bytes**; including provenance JSON, the static asset directory is **12,022 bytes**. Only used SVGs load in the UI; notices/manifest are not automatically fetched during play.

## CC0 and lightweight 3D candidates considered

[Kenney UI Pack Sci-Fi](https://kenney.nl/assets/ui-pack-sci-fi) and [Adventure](https://kenney.nl/assets/ui-pack-adventure) state CC0 on their official pages. [Quaternius Platformer Game Kit](https://quaternius.com/packs/ultimateplatformer.html) is an official CC0 3D platformer kit with characters/props. Normal supported-proxy requests to **kenney.nl** and **quaternius.com** both failed at CONNECT with **HTTP 403 Forbidden, server envoy**, on 2026-10-07. No proxy, mirror or alternate route was used to evade those denials. Web research could read their listings, but that did not make the ZIP/model files available inside the execution environment.

A small Quaternius character/prop would fit the warm platformer theme, but its actual file size, geometry budget and exact included license could not be inspected from this environment, so no 3D asset is claimed or shipped. The update instead uses the permitted, independently licensed Lucide source and keeps the existing lightweight 3D scenery/character. No paid Unity material, large model, shader or new game mechanic was added.

## Visible changes

- Orbit: dark blue/cyan panel system with orbital emblem; Amber: warm plum/copper with gem emblem. Introduction, pause, retry and trophy-clear screens have distinct hierarchy and artwork.
- Stage cards show names, selection rail, and explicit locked/completed icon states. Primary actions occupy a clear full-width row on phones; secondary actions remain separate.
- Touch controls use matching SVG arrows and stronger pressed styling. Phone instructions omit desktop keyboard clutter. HUD spacing/type is adjusted without adding scenery-covering controls.
- Brief clear-emblem arrival, button press feedback and a small 220ms landing indicator; `prefers-reduced-motion` disables animation. No looping decoration or full-screen effect during play.
- Result-only SVGs are preloaded so their first appearance does not flash blank.

Each game's three stages, collision/input model, storage key/save schema, renderer resolution budget and performance criteria are unchanged. Existing pages and PR #2 prototypes are untouched. A user-reported basic iPhone play check of the previous release is acknowledged; it is not a detailed device/performance validation of this new UI.

## Review evidence and checks

`scripts/games-ui-review.ts before|after` captures the same 390x844, 320x568 and 844x390 viewports. Normal keyboard/touch input produces the clear and retry screens; no game-state injection is used. [Before images](evidence/ui-refresh/before/) · [After images](evidence/ui-refresh/after/). Pause/result captures wait for short UI animation settlement; the normal-input completion tests remain independent of these screenshots.

Local strict game types, 7 unit tests and final UI build pass. The initial 13-case Chromium run passed 10 and failed 3 performance gates: Orbit desktop 26.03fps/p95 66.6ms, Orbit touch 42.22fps/50ms, Amber desktop 27.34fps/66.6ms. Amber touch passed at 51.82fps/33.4ms. All six stages were completed through normal input in both modes before the performance assertions; the failed cases did not reach their subsequent persistence assertions. Dedicated storage, simultaneous touch, focus/restart/orientation, both games' WebGL recovery, 320px scroll and simulated safe-area checks passed. See [initial run](evidence/ui-refresh/local-initial/browser.log). This run precedes the final result-icon preload and the additional asset/save/reduced-motion test; it is not a final-SHA pass.

Final payload versus released UI: JavaScript 542,472 → 543,727 bytes (**+1,255**), linked CSS 6,047 → 14,536 (**+8,489**), Orbit HTML 2,263 → 3,207 (**+944**), plus 4,816 bytes of SVGs when all used artwork has loaded. Gzip JavaScript increases 524 bytes. [Measured sizes](evidence/ui-refresh/payload.json). No owned commercial packs have been supplied or used.

The diagnostic baseline is now the actual released commit dce870d. Three predeclared alternating rounds cover desktop and mobile on one browser/runner. A 1500ms initial-segment sample must end in running state, excluding the previous diagnostic's possible failure-menu contamination. It is not a substitute for full-stage performance gates or moving-touch/landing animation coverage. Same-runner comparison, new asset test and final-SHA CI results are pending. Existing known cloud software-GPU variability must not be attributed solely to CPU model or hidden by relaxed thresholds. Cross-browser CI remains configured for WebKit/Firefox. Independent parent review is required before merge, even if tests pass.


## Exact candidate e2466c1 — do not publish

[CI 37629278027](https://github.com/shou773/pocketey-portal/actions/runs/37629278027) passes build/types, 7 unit tests, 10/10 WebKit/Firefox cases and 12/14 Chromium cases. Desktop Orbit 38.78fps and Amber 40.43fps fail the unchanged 45fps minimum; mobile stage-3 results pass at 52.78/51.59fps (p95 16.8/33.3ms). Desktop p99/max reaches 283–383ms.

Crucially, same-runner initial-segment comparisons show repeatable extra candidate desktop stalls: candidate roughly 12–21fps versus baseline 37–59fps, while mobile mostly stays near 54–60fps. This must not be dismissed as runner variability; investigation is open. [CI comparison](evidence/ui-refresh/ci-e2466c1-comparison.json). The local diagnostic originally crashed on too few callbacks; its interrupted output is retained. The corrected diagnostic explicitly retains six invalid samples out of 24, including all candidate desktop Orbit samples. Its short mobile samples are mixed, not evidence that the full candidate has no regression.

After e2466c1, follow-up changes extend safe-area padding to HUD/hints and test their bounds, observe reduced-motion over an actual jump/landing, wait for result animations before QA screenshots, and retain undersampled diagnostic records. Local targeted checks pass 3/3 after these changes. These require renewed exact-SHA CI and independent review. No merge or deployment has occurred for PR #4.


## Investigation checkpoint before the backdrop correction

CSS ablation used 2 predeclared reversed-order rounds, same 1280x720 browser and Amber stage-1 first 3 seconds: normal UI, mask removal, button transition removal, and combined flat buttons/no masks. These post-navigation overrides did not remove the stalls; they do not exclude initial stylesheet/SVG/compositor setup cost because loading had already occurred. Raw [CSS ablation](evidence/ui-refresh/local-initial/css-ablation.log).

An ordinary-input Amber stage-3 comparison alternated normal/reduced-motion preferences. Normal results 31.32/21.00fps versus reduced 28.86/30.81fps; neither satisfies the gate and no consistent motion-only cure is established. All four normal-input runs completed. [Motion ablation](evidence/ui-refresh/local-initial/motion-ablation.log). Do not claim a diagnosed root cause yet.

Next: compare released/candidate full-stage playback on the same runner, and isolate new stylesheet sections before navigation (the prior post-load overrides cannot exclude startup compilation/raster costs). Preserve the artwork and usable mobile layout while correcting demonstrated regressions. Parent confirmed no merge permission for this candidate.


## Review fixes and first measured cost correction

- At 320x568, compact portrait menus remove the large decorative emblem and tighten vertical spacing. Before scrolling, Orbit's 46px start button spans y310.05–356.05; Amber y301.80–347.80, both inside overlay y59–473. [Images and bounds](evidence/ui-refresh/review-fixes/). Start/stage/reset/clear/pause remain scroll-accessible.
- Amber's held selector now wins over its jump gradient. Native simultaneous right+jump produces rgb(255,211,147) background, no gradient, and rgb(21,39,46) text for both controls; release clears both. Screenshot and computed styles are in the same review-fixes directory. Targeted checks pass 3/3.
- The stylesheet ablation is now applied before navigation. Two reversed-order rounds show the candidate's backdrop blur costs 1306/1463ms for the first 10 frames, versus 319/511ms without it (358/374ms with blur and shadows both removed). Retaining shadows while removing backdrop blur addresses this measured startup cost without removing artwork or weakening the renderer. Later-frame FPS remains variable; this observation does not establish a full-stage performance pass. New exact-SHA CI is required.
