# Performance investigation handoff — 2026-10-07 11:53 UTC

Parent requested immediate preservation and transfer to the updated environment. No further implementation belongs to the old task after this handoff. Main and production remain unchanged.

## Saved implementation

- `9356e5b520e539e9c2f6bca37a317356244e7c3b`: avoid synchronous layout caused by reading canvas dimensions after HUD writes. ResizeObserver now caches dimensions; renderer also notices DPR changes without requiring CSS size changes. Unchanged HUD text is not rewritten; progress uses a transform rather than width layout. Pixel budget remains 450,000, DPR cap 1.6, and performance thresholds remain >=45fps / p95 <=40ms.
- `9158381e2730436700341f1383bea9798de87ca3`: current code SHA; additionally exposes comparison environment in CI logs. App is identical to 9356e5b.
- `scripts/games-performance.mjs`: three predeclared alternating baseline/candidate rounds in one browser/runner, fresh closed context per measurement, same 1280x720 DPR1 first-stage scene. This is diagnostic sampling, not stage-completion evidence. Workflow builds baseline `0cbc1e4` in a temporary directory using the same installed dependencies, runs the comparison, then all normal tests. Results uploaded with games-evidence.
- Stage-3 tests now record browser, canvas dimensions, DPR, renderer and context/page counts. Performance assertions were not weakened or removed.

## Findings and limits

Baseline paused scene incurred about 210 layouts over 210 frames because identical HUD text was replaced each frame. Source inspection identifies canvas clientWidth/clientHeight reads directly after HUD mutations; those synchronous reads are removed. Normal timer updates still legitimately cause layout, so the total LayoutCount is not expected to become zero.

Local controlled comparison, fps across three rounds:

| Scene | Baseline 0cbc1e4 | Candidate application 9356e5b |
| --- | --- | --- |
| Orbit stage 1 | 51.28 / 48.78 / 55.05 | 51.28 / 58.25 / 57.69 |
| Amber stage 1 | 57.15 / 57.15 / 60.00 | 60.00 / 58.83 / 60.00 |

Canvas stayed 1008x446, 10 draw calls/frame, 5 geometries, one WebGL context created per sample, one browser context during sampling and zero after closing it. No accumulation across those 12 samples was observed. Existing repeated-restart test remains in the final matrix; its latest result is not yet known at handoff.

Layout durations generally fell, but samples overlap and fps varies. These data do not establish that the original CI ~41fps was solely an application regression or solely host contention. A separate local DPR1 vs0.7 comparison reduced the buffer from 1008x446 to895x396; it did not show consistent fps improvement across all rounds. Raw exploratory results are preserved. Current hardware: Chromium151.0.7922.173 / Linux SwiftShader, EPYC9V74, 5 logical CPUs exposed, availableParallelism4, cgroup CPU quota4. Original CI may have different CPU/browser conditions; collect its comparison logs before drawing a conclusion. No physical-device claim.

## Tests pending at transfer

- On **9158381**, local game types, 7 unit tests and build passed. Browser suite is in progress; first three cases passed: Orbit keyboard 53.78fps/p95 33.3ms, Orbit touch60.00/16.7, Amber keyboard52.06/33.3. Remaining cases are unverified at snapshot time. Local process session44207, log `/tmp/pocketey-915-browser.log`; old environment output may not survive migration.
- [Latest exact-SHA CI run37616821830](https://github.com/shou773/pocketey-portal/actions/runs/37616821830), job112777060207: build/types/unit and diagnostic execution succeeded; full browser suite in progress. Read final logs, including ENVIRONMENT, JSON comparison rows and all 13 test results. Comparison execution success is not itself a performance pass.
- Prior code run37616759899 on9356e5b is superseded by logging-only9158381. Record its outcome separately if using its measurements; do not substitute it for latest-SHA checks.
- Earlier safe-area code0cbc1e4 run37615165970 remains failed at desktop41.31/41.16fps, p9550ms. The separate Cloudflare failure is unresolved and is not this performance failure.
- Current screenshots for these performance changes are not yet inspected. Use latest browser output and confirm portrait/landscape rendering after completing tests.

## Reproduction in the new environment

```sh
npm ci --cache /tmp/pocketey-npm
npm run check:games
npm test
ASTRO_TELEMETRY_DISABLED=1 npm run build
npm run test:browser
```

`playwright.config.ts` selects `/usr/bin/chromium` locally, Playwright Chromium in CI, single worker and SwiftShader. Confirm browser availability in the new environment before running. Official previously blocked browser downloads and production-origin verification now belong to the new authorized task; the old task made no new connection attempt.

Controlled comparison (from repository root, with baseline object available):

```sh
baseline_dir=$(mktemp -d /tmp/pocketey-baseline.XXXXXX)
git archive 0cbc1e4ed6059adaa03e6fc49c6902b7d3a58853 | tar -x -C "$baseline_dir"
ln -s "$PWD/node_modules" "$baseline_dir/node_modules"
(cd "$baseline_dir" && ASTRO_TELEMETRY_DISABLED=1 npm run build)
node scripts/games-performance.mjs "$baseline_dir/dist" dist
```

Evidence: `evidence/performance-investigation/`. Do not change thresholds or repeat until green. If CI still fails, use same-run baseline/candidate results and exact environment to decide between further rendering optimization and a documented CI-resource limitation. Keep publication gated on unresolved quality and live verification, with physical-phone limitations explicit.
