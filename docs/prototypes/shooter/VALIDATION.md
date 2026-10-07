# Validation / 検証結果

Local Chromium `/usr/bin/chromium`, SwiftShader software GPU, Node/npm from the selected workspace. No physical-device claim. Commands and input sources are in README.md and `tests/prototypes/`.

## Passed / 成功

- `ASTRO_TELEMETRY_DISABLED=1 npm run check`: **0 errors, 0 warnings**, five informational hints.
- `npm run check:games` and isolated prototype/test TypeScript configuration: pass.
- Existing model suite: **7/7**. Shooter model suite: **9/9** (bounded/rate-limited deterministic movement; circle and swept hit tests; damage grace/terminal states; warning and expiration; enemy destruction/score; all-stage scheduling; boss deadline; boss clear; simultaneous fatal/boss priority; save sanitation).
- Static Astro build and existing portal retirement guard: pass. Three.js large-chunk warning remains; reused existing dependency is about 133 kB gzip. No package/lock changes.
- UI/browser checks at **320×568, 390×844, 844×390, 1280×900**, both languages: launch remains accessible, no horizontal overflow; keyboard release and depth movement, relative touch/depth and cancel, pause/resume, mid-pause locale change, blur pause, repeated retry and sound-save behavior pass. Corrupt/blocked storage, unsupported WebGL and context loss pass.
- Stage 3 idle failure occurs at **11.58s**, then Retry restores four shields and fresh time; Stage select works. Writing the shooter save retains the existing-game key sentinel unchanged.
- Real-input complete runs below. These are actual keyboard or CDP touch inputs observed through read-only state diagnostics, without engine mutation. Each path ran sequentially in its own browser. Full trace summaries and screenshots: `evidence/play-report.json`, `touch-*`, `keyboard-*`.

| Input | Stage | Outcome | Remaining shields | Time | Score | Input updates |
| --- | --- | --- | --- | --- | --- | --- |
| Touch | 1 | Clear | 3/4 | 36.00s | 1300 | 328 |
| Touch | 2 | Clear | 3/4 | 42.00s | 2000 | 381 |
| Touch | 3 | Boss defeated | 2/4 | 36.40s | 2600 | 328 |
| Keyboard | 1 | Clear | 3/4 | 36.00s | 1300 | 124 |
| Keyboard | 2 | Clear | 3/4 | 42.00s | 2000 | 144 |
| Keyboard | 3 | Boss defeated | 1/4 | 36.73s | 2600 | 135 |

Final gameplay images were visually inspected: the mobile boss and desktop stage 2 show visible enemies/bullets, a matching white hit core, depth cues, health/time, and boss health. Final menu/layout captures were inspected at 320 and landscape 844. Result/play traces precede the final CSS-only removal of menu backdrop blur; final UI captures and performance were rerun afterward. Simulation, controls and combat rendering were unchanged by that optimization.

## Performance / 性能

Same local Chromium, 390×844, DPR1, sequential eight-second samples after two-second warmup. This measures menu and early Stage 2 on a software GPU, not real mobile GPU speed. Full methodology and renderer string are in `evidence/performance.json`.

| Scene | JS render/frame work p95 | Frame interval p95 | Samples |
| --- | --- | --- | --- |
| Existing Orbit Ribbon menu, unchanged source | 2.2ms | 16.7ms | 478 |
| Pulse Drift menu, final | 1.2ms | 16.8ms | 480 |
| Pulse Drift Stage 2, final | 1.1ms | 16.8ms | 480 |

Before removing the CSS menu backdrop blur, the shooter menu p95 frame interval was **50ms** (`performance-before-menu-fix.json`). Removing that effect improved it to **16.8ms**; no physics or CI-only behavior was changed. During full runs the largest observed scene was **55 draw calls / 1,420 triangles**. Pixel ratio capped at 1.5; no shadows/textures/postprocessing.

## Earlier failures and fixes / 初期失敗と修正

- Float accumulation missed the exact survival deadline by tiny rounding error; added a 1e-9 deadline tolerance and kept fatal-hit priority. Model deadline test passes.
- Reviewer found keyboard overshoot and simultaneous fatal/boss victory overwrite; fixed and verified (see REVIEW.md).
- Early simultaneous-browser runs paused a test when another window stole focus, and distorted rendering samples. Some early keyboard completions failed under this setup. Final complete runs and performance measurements are sequential; the failed setup was not used as completion evidence.
- Initial touch-cancel assertion sampled the six-frame diagnostics before a fresh post-cancel snapshot under concurrent software GPU load. Pointer-cancel/lost-capture events were inspected and movement stopped; UI checks now wait for settled snapshots and pass at all four sizes.
- Astro check initially lacked the sandbox-safe telemetry flag and could not create a home configuration directory. Rerun with `ASTRO_TELEMETRY_DISABLED=1` passed.

## Unverified / 未確認

Real iOS/Android hardware, physical audio output, actual BFCache restore, human novice difficulty calibration, and broad hardware GPU/cross-browser performance. Controlled blur/pause and visibility-handler source review are verified; the test does not claim a real OS background-tab/restore cycle across mobile browsers. Public hosting/production CI were not run or deployed. Small 320×568 screens require a short vertical scroll for footer/bottom Stage select. WebGL loss requires reload. Any future public release must exclude prototypes from sitemap, obtain user approval, and recheck then-current main.
