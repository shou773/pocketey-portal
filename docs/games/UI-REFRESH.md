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

Final payload versus released UI: JavaScript 542,472 → 543,727 bytes (**+1,255**), linked CSS 6,047 → 13,218 (**+7,171**), Orbit HTML 2,263 → 3,207 (**+944**), plus 4,816 bytes of SVGs when all used artwork has loaded. Gzip JavaScript increases 524 bytes. [Measured sizes](evidence/ui-refresh/payload.json). No owned commercial packs have been supplied or used.

The diagnostic baseline is now the actual released commit dce870d. Three predeclared alternating rounds cover desktop and mobile on one browser/runner. A 1500ms initial-segment sample must end in running state, excluding the previous diagnostic's possible failure-menu contamination. It is not a substitute for full-stage performance gates or moving-touch/landing animation coverage. Same-runner comparison, new asset test and final-SHA CI results are pending. Existing known cloud software-GPU variability must not be attributed solely to CPU model or hidden by relaxed thresholds. Cross-browser CI remains configured for WebKit/Firefox. Independent parent review is required before merge, even if tests pass.
