# Updated environment verification — 2026-10-07

Follow-up **b9a6741b3d33d23702a14d6e9e24d0e857ff9a7c** adds explicit drawing-buffer aspect assertions before orientation screenshots, plus live gameplay captures. Its [run 37619282408](https://github.com/shou773/pocketey-portal/actions/runs/37619282408) passes all 10 cross-browser cases. The separate quality job stops at a new test TypeScript error (canvas element needed an HTMLCanvasElement cast); it did not execute Chromium tests. The working follow-up corrects that cast and adds raw rAF/input timing evidence, retaining all thresholds. Final candidate checks remain pending; do not transfer the earlier CI pass to untested changes.

## Candidate and exact CI evidence

Application/test candidate **165ce973d386e16c174978fab834474a0a507336** adds shared ordinary-input test helpers and an independent WebKit/Firefox CI job. Application source is identical to **9158381**. No rendering experiment below was retained, and no resolution budget or performance threshold changed.

[Games quality run 37618004427](https://github.com/shou773/pocketey-portal/actions/runs/37618004427) on **165ce97** succeeded:

- Build, game TypeScript and 7 unit tests.
- Chromium **13/13** browser tests: all six stages in keyboard and native CDP multi-touch modes, unlocks, reload/reopen persistence, sound settings, failure/retry, focus/pause input clearing, repeated restart, WebGL loss/restoration/reload, corrupt/blocked storage and scoped reset, scrolling menus, navigation, portrait/landscape and four-edge synthetic safe areas.
- WebKit **5/5** and Firefox **5/5**: all six stages per engine through normal keyboard input at phone dimensions; saved unlocks/bests and sound setting; WebGL loss/reload; mouse pointer plus keyboard jumping, release, blur/pause/resume; repeated restart; 320px scrollable menus and portrait/landscape; corrupt storage/reset. These tests do not inject native multi-touch into WebKit/Firefox, simulate physical iPhone Safari, or test audible output on hardware.

| Chromium stage 3 | Mean fps | p95 ms |
| --- | ---: | ---: |
| Orbit keyboard, 1280x720 | 57.29 | 16.8 |
| Orbit touch, 390x844 | 60.00 | 16.8 |
| Amber keyboard, 1280x720 | 54.29 | 16.8 |
| Amber touch, 390x844 | 60.00 | 16.7 |

CI: Chromium 153.0.8010.12, SwiftShader, Linux, Node 22.23.3, AMD EPYC 9V45, 4 CPUs. WebKit 26.6 and Firefox 155.0 run on the separate Ubuntu job with official dependencies and Xvfb. [Chromium artifact](https://github.com/shou773/pocketey-portal/actions/runs/37618004427/artifacts/11479929673), [cross-browser artifact](https://github.com/shou773/pocketey-portal/actions/runs/37618004427/artifacts/11480124385). Saved reports/images are in [updated-environment](evidence/updated-environment/).

## Performance limitations and unsuccessful results

This successful CI is not a universal device-performance claim, nor proof that all earlier performance failures are fixed. Earlier **9158381** [run 37616821830](https://github.com/shou773/pocketey-portal/actions/runs/37616821830) failed 2/13 cases: desktop Orbit 38.91fps/p95 50ms; Amber 40.14fps/p95 33.5ms. Its AMD EPYC 9V74 runner also measured low baseline performance in the same alternating comparison. No contexts accumulated. Both builds being slow supports host sensitivity, but does not isolate a unique cause. The newer run was triggered by substantive cross-browser test/workflow additions, not a rerun-until-green operation.

The republished local environment differs again: Intel Xeon Platinum 8573C, Chromium 151.0.7922.173, SwiftShader, 5 logical CPUs and a four-CPU cgroup quota. Its initial **bc9c627** application run passed **9/13**, failing desktop performance (Orbit 32.76fps/p95 50ms; Amber 26.57fps/p95 66.6ms), one coordinate-observing Orbit touch controller at stage 2, and the restart wall-time assertion (x=5.483 versus >5.5 after one second). The full report is preserved. This is not reported as a successful local release matrix, and the input/restart failures are not asserted to have a proven root cause.

A targeted actual-stage-3 keyboard diagnostic records 200 raw rAF intervals with the unchanged first-10 exclusion. Orbit: 30.73fps, p95 50ms, max 66.7ms, 32/190 measured intervals above 40ms. Amber: 31.41fps, p95 50ms, max 66.7ms, 31/190 above 40ms. Input read+dispatch cycle medians were 21/22ms, p95 44/41ms, maximum 92/71ms. These local samples show sustained slower cadence, not only rare extreme stalls; they do not explain the earlier CI samples without raw data. The diagnostics record timestamps/coordinates but never modify player state. Both targeted performance assertions remain failed.

Vignette removal at the same 1280x720 viewport and unchanged buffer gave baseline/no-vignette fps 43.35/28.94, 33.93/47.70 and 41.61/50.67 across three alternating rounds. Results are mixed, so the effect was not removed. Cgroup throttling counters increased during the software-rendered investigation; they establish quota pressure, not sole causation. The static Amber diagnostic has no movement and is not the input-driven stage-3 acceptance scene.

Three alternating canvas/HUD-layer comparisons did not show consistent improvement. A subsequent vertex-lighting experiment likewise did not consistently improve the unchanged-resolution scene and was discarded. Raw results are retained as diagnostics, not release passes. In the slower Orbit diagnostic samples the unattended player fell into a gap and the result overlay appeared, so those samples are contaminated by a changed scene and must not be used to claim a lighting speedup. No production shader change was kept.

The release CI is the passing quantified gate for this candidate. Cloud software rendering and runner hardware vary; physical iOS/Android performance, thermal behavior, first-play reaction fairness and hardware audio remain unverified. Full-stage controllers read coordinates to time normal inputs; they demonstrate feasibility, not human enjoyment or novice fairness.

## Access and deployment

Normal supported-proxy requests now reach `https://pocketey.com/`, redirect to `https://www.pocketey.com/`, and return HTTP 200 with GitHub Pages headers. Existing `/about/` and `/contact/` return 200. `/games/` returned 404 before publication. The repository's static Astro configuration and `public/CNAME` both name `www.pocketey.com`. Existing publication is the main-triggered `.github/workflows/deploy.yml` (Astro build, then `actions/deploy-pages@v4`). No DNS, access/security settings or Sites service is involved.

Official WebKit/Firefox downloads now succeed locally. Local WebKit startup lacks `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libharfbuzz-icu.so.0`, `libmanette-0.2.so.0`, `libhyphen.so.0`, and `libGLESv2.so.2`. Official dependency installation cannot authenticate as root. A user-directory APT metadata attempt at the configured official snapshot repository returned proxy 403; no alternate route was used. Firefox starts with approved elevated filesystem execution but has no local WebGL2 context. The official Chromium 153 installer also still receives a 403. These local limitations were addressed by the existing GitHub Actions cross-browser job, where official installation and execution succeeded.

Cloudflare Pages remains a separate failed integration with its detailed cause unresolved. Existing baseline main also failed that integration; this does not prove identical cause. Whole-site Astro check's 48 legacy contact-page errors remain outside this change and are matched against baseline in prior evidence. Neither is represented as passing.

Pre-release rollback baseline: **63f48b60aefb892ec167f4186b5b593ac1d10e65**, the previously deployed main. For a blocking publication regression, revert the release merge on main and verify the resulting Pages deployment; retain feature commits and PR #2 prototypes.

Publication and exact deployed-commit/live smoke results will be recorded separately after deployment.
