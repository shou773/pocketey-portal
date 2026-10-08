# Amber approved visual revision — integration QA

[Subsequent approved touch-test synchronization](../touch-synchronization/README.md) records the limited CI-failure diagnosis and bounded game-clock wait. It supersedes this checkpoint's base and final-test status; its rebase includes Pulse PR16 without changing the approved Amber art.

The parent approved the two-point visual revision at `2bde0bcb31d01b90d2bcccb23769703004f20793`. It was rebased cleanly onto main `8714b3f7724df370326a45a615ca98e21f5607da` (portal PR12 and Pulse PR11 included), producing runtime commit `49c9240d97115c727ea345c7b1de5931d2d59a6b`. The renderer, Amber scenery and Amber asset bytes are identical before/after rebase. This directory adds evidence only. Orbit's separate, unmerged revision is not imported. Merge and publication remain the parent's responsibility.

`model.ts`, `app.ts`, `art.ts`, audio, shared UI, dependencies and workflows have no candidate diff against this main. No gameplay tuning accompanies the approved art.

## Public comparator and fixed protocol

The downloaded live Amber bundle and the main build both identify `ActionGame.astro_astro_type_script_index_0_lang.DfSnJRsW.js`, SHA256 `4d4c0f2f0d257c28a7188afec31ad2d255726dd97e1835dafa64e917003d568f`. Thus this comparator matches the public Amber runtime. The unchanged CI workflow's historical `711b53` comparator is a different revision; it is not relabeled as current public main.

[compare.ts](compare.ts) and [all raw samples](comparison.json) record one predeclared ABBA order for each viewport/mode, sequential fresh contexts in one Chromium151 SwiftShader process, equal framebuffers and renderer, sound ON, native start, 1.5s simulation warmup, then five seconds of real-time rAF. The first ten intervals are excluded from aggregates, retained in the raw data. Desktop1280×720 uses795×351 pixels; phone390×844 uses390×690, DPR1. No concurrent browser job, held callbacks, pose injection or passing-host rerun was used.

Stationary samples are stage1 at x0 with normal idle animation; they measure rendering only. Moving samples use the existing keyboard/touch stage3 driver, then continue through native clear and save. All16 windows stay in running/play, all8 moving runs clear and save, and no runtime error occurs. Raw positions, simulation time and inputs are retained: moving progress is approximately x7→32, with the stalled phone sample x6.917→31.333. This is similar progress, not identical frame-by-frame motion.

| Mode | Public fps (two samples) | Candidate fps (two samples) | Public / candidate mean change | Candidate p95 ms |
| --- | --- | --- | --- | --- |
| Desktop stationary | 58.35,54.23 | 54.62,54.17 | −3.37% | 33.3,33.3 |
| Desktop moving | 48.71,48.54 | 46.76,48.79 | −1.75% | 33.4,33.4 |
| Phone stationary | 60.00,59.80 | 60.00,60.00 | +0.17% | 16.7,16.7 |
| Phone moving | 60.00,60.00 | 57.12,60.00 | −2.41% | 16.8,16.8 |

All16 five-second aggregates meet45fps/p95≤40ms, but candidate means are slightly lower in three groups. One moving-phone candidate interval is233.3ms; its cause is unproven. These diagnostics do not establish strict performance non-regression or real-phone FPS. The earlier42.26fps stationary sample remains in the parent directory and is not erased by these longer windows. The unchanged200-frame stage3 release gate is evaluated separately below.

## Checks and remaining gates

Game TypeScript,24 model tests and production build pass. Astro check after adding the measurement source passes with0 errors/0 warnings/6 hints across78 files. A preliminary check without disabling Astro telemetry failed while trying to create its home-directory config; the normal `ASTRO_TELEMETRY_DISABLED=1` invocation succeeds. No permission bypass was used.

The existing20-case Chromium suite passes19. Its sole failure is Amber keyboard stage3 FPS42.8594 (<45), p95 33.4ms. Amber touch is60.0032fps. Both input modes complete all three stages, preserve sound ON and unlock/best values across reload and a new page, and restart stage3; see [keyboard evidence](candidate-keyboard/) and [touch evidence](candidate-touch/). Other passing checks cover context loss/recovery, narrow layout, touch feedback, animation, missing GLBs and missing palette. [Full execution log](browser.log) retains the failure. No gate is relaxed.

The matching public-main run of the same existing Amber keyboard/touch gates also completes all three stages and persistence. It passes touch59.6902fps/p95 16.8ms, fails desktop34.4428fps/p95 50ms, yielding1/2 passing cases. [Public keyboard](public-keyboard/), [public touch](public-touch/) and [gate log](public-gates.log) retain raw intervals, actual renderer/buffer, inputs, screenshots and completion/save values. These were sequential same-machine runs (candidate full suite, then the public Amber cases), not interleaved statistical trials. Both use Chromium151/SwiftShader, desktop795×351 and phone390×690 framebuffers. Public uses the existing baseline config/Python static server and candidate uses Astro production preview. The candidate's better desktop result in this pair does not turn its failed45fps gate into a pass, and does not explain the small lower means in the fixed-duration comparison.

The unchanged portal suite passes20/20: four-game access/design/contrast, bilingual navigation, redirects/metadata, contact validation and translations, and both games' English full-stage play. Amber's three English stages, translated results and bilingual320px save/pause/recovery checks pass. [Portal log](portal.log) records the complete run; [Amber cases](portal-report-amber.json) retain the relevant structured results. These are local Chromium results on runtime49c9240, not a claim that the full CI matrix is green.

Local Firefox/WebKit are blocked by browser profile/host dependency failures; [launch diagnostics](browser-availability.log) are retained. The standard CI installs these dependencies on its runner. No cross-browser pass is claimed locally.

The authenticated `gh run list` request for this branch returned `Forbidden`; the available GitHub connector lacks workflow_dispatch, and its commit-run wrapper lists only PR-triggered runs. Existing Games quality has no PR trigger and does not automatically run on this art branch. Parent dispatch of the final pushed SHA is required to obtain exact-head full CI. No workflow, branch or token is modified to work around the denial; no merge or deployment is attempted.
