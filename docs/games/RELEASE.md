# Release record

**Published 2026-10-07.** [Live URLs, exact deployment commit, public-origin smoke checks and rollback record](PUBLISHED.md). The candidate/investigation sections below retain their historical status and failures.

## Updated environment candidate (165ce97)

**Final verified code: 5e7b3c6581eb11f88a71da67da2cea2365557b3f.** [Run 37619942914](https://github.com/shou773/pocketey-portal/actions/runs/37619942914) passes build/types, 7 unit, 13 Chromium and 10 WebKit/Firefox tests. Final desktop stage 3: Orbit 53.52fps/p95 16.8ms; Amber 51.35fps/p95 33.4ms. Desktop p99/max still show occasional stalls; physical devices remain unverified. WebKit orientation projection is correct after explicit render-size synchronization. [Full final evidence and unsuccessful diagnostics](UPDATED-ENVIRONMENT.md). Publication/live game verification is the remaining step.

**Current evidence supersedes the historical access/browser blocks below:** normal-proxy production access works. [Updated environment report](UPDATED-ENVIRONMENT.md) records exact-SHA CI success on **165ce973d386e16c174978fab834474a0a507336**: build/types, 7 unit tests, 13 Chromium tests and 10 WebKit/Firefox tests. It also preserves the failed 9158381 CI and 9/13 local run, hardware differences, discarded rendering experiments and material limitations. The shader experiments were not retained. The passing CI is not evidence of universal mobile or cloud performance. Publication is still pending exact deployment and live smoke verification.

## Performance investigation in progress

Code `9158381` includes frame-layout improvements with unchanged render budget and performance thresholds. Final browser validation and exact-SHA CI are in progress at environment transfer; **no all-pass claim** is made. See [handoff and reproduction commands](PERFORMANCE-HANDOFF.md) and its timestamped evidence. Earlier results below retain their exact SHA.

## Landscape safe-area revision (0cbc1e4)

Code SHA **`0cbc1e4ed6059adaa03e6fc49c6902b7d3a58853`** fixes the landscape bottom padding override with `max(7px, env(safe-area-inset-bottom))`. At 844x390 with insets top 0 / bottom 21 / left and right 44, the failing control bottom **383px** is now **369px**, exactly the safe boundary, in both games. Regression tests assert the bounds of the wordmark and every toolbar/movement/jump control against all four edges in portrait and landscape. Local build, game TypeScript, 7 unit tests and the 5 affected browser tests pass. [Games quality CI run 37615165970](https://github.com/shou773/pocketey-portal/actions/runs/37615165970) on that exact SHA **failed: 11/13 browser tests passed**. Both safe-area tests passed. The two desktop stage-completion tests reached stage-3 clear, then failed the >=45fps assertion: Orbit **41.31fps**, Amber **41.16fps**. Both also measured p95 50ms (target <=40ms); that assertion and subsequent persistence assertions did not run after the fps failure. Touch-emulated stage-3 results passed at 59.07/58.77fps, p95 16.8/16.7ms. Build/types and all 7 unit tests passed in CI. This is an unmet performance gate; no threshold was relaxed and the run was not retried to obtain a green result. [Exact evidence](evidence/safe-area-regression.json). The separate Cloudflare Pages check `112771667617` also failed with unresolved cause. Publication remains on hold.

Both games' updated portrait/landscape screenshots and individual control measurements are in [mobile-review](evidence/mobile-review/). The previous generic notch images have also been replaced. This uses Chromium synthetic safe-area overrides; it is not physical iPhone or Safari evidence. Prior stage-completion/performance measurements below retain their original SHA and were not relabeled as measurements of this CSS revision.

## Earlier mobile-review result (95ed0c6)

Application fixes are in `25ed2ad`; final synchronized test code is in **`95ed0c65836c5c1ee7cf2ac2b1567a4dc0a24e12`**. On that SHA, local build, strict game types, **7 unit tests and 12 Chromium browser tests pass**. [Games quality run 37613951469](https://github.com/shou773/pocketey-portal/actions/runs/37613951469) also succeeded on **that exact SHA**. Subsequent evidence-only commits do not imply a fresh CI execution. The earlier failed run 37612979382 remains failed; the screenshot wait was removed and the controller now waits explicitly for the new run's first frame before sending inputs.

Current stage-3 measurements: Orbit desktop **52.78fps / p95 33.3ms**, Orbit touch emulation **60.00fps / 16.8ms**, Amber desktop **54.81fps / 33.3ms**, Amber touch emulation **60.00fps / 16.7ms**. Test conditions remain the Chromium/SwiftShader cloud conditions below. [Current machine-readable QA](evidence/qa.json).

[Updated mobile-review images](evidence/mobile-review/) show recovery, 320x568 panel tops/bottoms, 390px controls, synthetic notch insets and screen-guided gap crossings. An additional Chromium CDP **touch swipe**, without scripted scroll writes, moved the 320x568 menu from scrollTop 0 to 109px (Orbit) / 84px (Amber), exposing reset controls in both games; [touch-scroll evidence](evidence/mobile-review/touch-scroll.json).

The Cloudflare Pages integration remains a separate failing check with unresolved cause; Games quality success is not a successful Cloudflare or production deployment. No production access, WebKit/Firefox download retry, DNS change or publication was performed in this review.

## Deliverable

- Orbit Ribbon: `/games/orbit-ribbon/`
- Amber Step: `/games/amber-step/`
- Discovery hub: `/games/`, linked from the existing site header on desktop and mobile.

These paths are built locally. They are **not asserted to be available on pocketey.com yet**.

## Test conditions

Cloud Linux x86_64, AMD EPYC 9V74 virtual CPU (5 logical CPUs exposed), Node 24.19.0. Chromium 151.0.7922.173 launched headlessly through Playwright. WebGL renderer: ANGLE / Vulkan 1.3.0 / SwiftShader Device (Subzero), software rendering. Desktop keyboard context 1280x720, DPR 1. Mobile-emulated context 390x844, DPR 1, isMobile + hasTouch, Chromium CDP multi-touch. Responsive checks additionally cover 320x568, 844x390 and 1440x900. This is not physical phone or Safari testing.

Release threshold chosen before final testing: average rendered rAF cadence >=45fps, p95 interval <=40ms on this software-rendered cloud environment; 60fps target. Each game's stage 3 is measured during ordinary-input play (200 rAF samples; first 10 discarded). The renderer batches static meshes, shares geometry, caps target pixels at 450,000 and DPR at 1.6, and uses diffuse lighting. Browser/OS compositing and automation overhead are included. Results are reproducible measurements, not a universal hardware claim.

## Measured result (implementation 2bd6006)

Local final matrix: **7/7 browser tests and 6/6 unit tests passed**; strict game TypeScript and production build passed (21 generated routes). The complete browser run took about 3.1 minutes. Existing global-check failures remain separately disclosed below.

| Stage 3 actual play | Viewport / input | Mean fps | p95 frame interval |
| --- | --- | ---: | ---: |
| Orbit Ribbon | 1280x720 / keyboard | 50.00 | 33.4ms |
| Orbit Ribbon | 390x844 / multi-touch emulation | 59.69 | 16.8ms |
| Amber Step | 1280x720 / keyboard | 54.55 | 33.3ms |
| Amber Step | 390x844 / multi-touch emulation | 60.00 | 16.8ms |

All six stages were completed in **both** input modes through normal browser input. The screenshots in [evidence](evidence/) include each touch completion, both portrait scenes, landscape and simultaneous move+jump. Machine-readable measurements: [qa.json](evidence/qa.json). No page JavaScript errors were observed in the completion matrix.

## Validation status

Final results and screenshots are recorded in the evidence directory and the GitHub quality artifact when available. Browser checks cover all six stages via actual keyboard and touch input, stage unlocking, next/replay, saves across reload/reopen, sound setting, fall/retry, pause/focus input clearing, 20 restarts, constant geometry counts, touch cancellation, simultaneous movement+jump, orientation/layout and existing navigation.

Six unit tests cover fixed-step equivalence at 30/60/120Hz, coyote time, jump buffering, failure/collision, reachable courses and corrupt-save sanitation. No debug teleport or invulnerability is used for browser completion evidence.

`npm run check:games` and `npm run build` are required. Whole-site `npm run check` reports 48 errors solely in the unchanged legacy `src/pages/contact.astro`. Its source is byte-identical to baseline main. Those errors are **not passed or fixed by this work**. No pre-existing lint script is configured; separate lint is unverified.

## Publication blocker and remaining gaps

Both `https://pocketey.com/` and `https://www.pocketey.com/` fail from the execution environment with `curl: (56) CONNECT tunnel failed, response 403`, proxy response `server: envoy`. An escalated read attempt produced the same result. This is an environment network-layer denial, not a verified response from the website. The environment has network enabled but exposes no destination-allowlist editor. Permitted outbound HTTPS access to those two hosts is needed to verify production. No alternate route is used to circumvent that restriction.

Authorized GitHub read tools verified the existing successful main-to-GitHub-Pages deployment and its www.pocketey.com environment URL (see README). Main integration and publication remain pending until production verification can be performed. No DNS, security, persistent credentials or Sites deployment was changed.

Physical iOS/Android, Safari/WebKit, Firefox, mobile thermal/battery behavior, and live-origin route/asset checks are unverified. The optional WebKit download was denied by the environment with HTTP 403 `Domain forbidden`. Do not label this a universally mobile-ready release.

## Supplemental browser availability and baseline check

The requested additional local WebKit/Firefox verification could not start. Neither engine is installed. Official Playwright installs for WebKit 26.6 (build 2359) and Firefox 155.0 (build 1543) failed with HTTP 403 `Domain forbidden` at `cdn.playwright.dev`; the installer's built-in `playwright.download.prss.microsoft.com` fallback also failed. No custom mirror/proxy or alternate environment was used. [Exact availability evidence](evidence/browser-availability.json). Consequently no new WebKit/Firefox screenshot or pass result exists. Their startup, ordinary touch completion, persistence, audio, focus return and landscape remain unverified; Chromium touch emulation is not iPhone Safari.

For the legacy type errors, baseline main `63f48b6` was extracted into an isolated directory and checked using the same installed checker and strict configuration as candidate `a1dabb2`. All 48 diagnostics match exactly by file, line, column, TypeScript code and message. This substantiates a pre-existing code issue rather than a game-change regression. [Diagnostic comparison](evidence/baseline-typecheck.json).

## CI and deployment status by SHA

| SHA | Check | Observed result |
| --- | --- | --- |
| `2bd6006` | Games quality / run 37610172506 | Success: build, game types, 6 unit + 7 Chromium browser tests |
| `2bd6006` | Cloudflare Pages / check 112755310194 | Failure: Build failed |
| `a1dabb2` | Games quality | Not rerun: docs/evidence-only commit excluded by workflow path filter |
| `a1dabb2` | Local checks | Build, game types, 6 unit + 7 browser tests passed; app/tests identical to 2bd6006 |
| `a1dabb2` | Cloudflare Pages / check 112756094550 | Failure: Build failed |
| baseline `63f48b6` | GitHub Pages build/deploy | Success |
| baseline `63f48b6` | Cloudflare Pages / check 103125036234 | Failure: Build failed |

[Machine-readable check ledger](evidence/check-ledger.json). **Do not describe all checks on the final head as successful.** Documentation-only follow-up commits also do not inherit a new CI execution merely because their application tree is identical.

The Cloudflare PR integration and the repository's main-triggered GitHub Pages workflow are separate checks/deployment paths. Cloudflare failures predate this change, but that alone does not prove the same root cause or zero production impact. GitHub exposes only `Build failed`, null log text and zero annotations for the candidate failure. The detailed log link leads to the Cloudflare dashboard; this environment has no authorized Cloudflare log reader. The exact Cloudflare build failure cause remains unresolved. Baseline GitHub Pages deployment success confirms the historical path, not current domain routing or successful game publication. Keep publication pending permitted live-domain verification and investigation of any relevant Cloudflare production configuration.

## Mobile review follow-up

WebGL context loss now latches a **reload-only recovery state**. Simulation and rendering stop, held input is cleared, sound/movement/pause controls are disabled, and no normal resume/retry action remains. Even successful WebGL restoration does not restart an invisible or interrupted run. Reload reinitializes the renderer and reads the saved record; context loss itself never writes storage. If storage is blocked, the recovery message explicitly warns that unsaved records will be lost on reload.

At 320x568 the overlay begins at a reachable scroll origin when the panel is taller than its available space; shorter panels remain centered. Tests cover start, reset confirmation, clear, unlocked stage selection and pause in both games, scrolling each visible control fully into view. Keyboard-only MOVE hints are hidden below 600px. Compact toolbar/jump labels do not wrap. The toolbar includes `safe-area-inset-top` in portrait and landscape; a Chromium safe-area override verifies 44px top / 44px side insets. This is simulated geometry, not physical device testing.

Orbit's fixed-edge route was reproduced for both signs of z≈3.5 in stages 2/3 using only movement/jump steps from the starting state. Side pillars now extend to the road edge, forcing the opposite safe lane. All four fixed-edge simulations now collide with a side pillar; the regular alternating path remains feasible. This is a layout adjustment, not a new mechanic.

### What the play evidence does and does not establish

The completion controller reads read-only internal positions to time **ordinary browser keyboard/touch input**. It never teleports or changes gameplay state. These completions establish reachability, input behavior and UI transitions; they **do not establish novice human reaction time, first-play difficulty, enjoyment or physical phone usability**. Screenshots are inspected for visible gaps, landing surfaces, obstruction contrast, fixed camera framing and readable controls, but this visual inspection is not a first-time human play study. Existing cyan/amber platform edges and contrasting pink obstacles remain the warning cues. No claim of proven first-play accessibility is made.


### Screen-guided observation

A separate short observation trial used the rendered 390x844 screen, ordinary keyboard controls and the game's pause/resume buttons, **without reading internal position/status attributes or changing simulation state**. In each game's stage 1, movement/jump timing was chosen after inspecting screenshots of the approaching gap; the airborne frame and successful landing were then inspected. The bright platform edge, dark gap and landing surface were distinguishable in these captures. [Before/jump/landing images](evidence/mobile-review/) are saved for both games. This was a paused, screen-guided observation over the first gap, not a full-stage novice reaction test or physical phone session. The full-stage keyboard/touch evidence remains the separately disclosed coordinate-observing automated controller.
