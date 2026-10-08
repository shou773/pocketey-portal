# Amber simultaneous-touch test synchronization

Parent-approved test-only fix after published main run [37744832694](https://github.com/shou773/pocketey-portal/actions/runs/37744832694) failed x>0.5 with x0.417. The Amber branch is rebased onto published main `f110bd89cbdaa24b912b419e0f7feac372298b86`, retaining Pulse PR16. The approved Amber renderer/scenery/asset bytes are identical to candidate `c332f2b`. No additional visual or runtime/gameplay change.

The simultaneous right+jump test now records the existing displayed game time after native CDP touchStart and waits for0.2s of game progression, with a3000ms timeout. The same x>0.5 and y>0.5 assertions follow. Input events, cancellation, layout checks and the separate300-frame45fps/p95≤40ms gate are unchanged. A stopped clock times out; lost move/jump still fails the unchanged assertions. The wait does not poll for the desired x/y result and does not change physics or difficulty.

## Evidence and limits

In that main CI, the native Amber touch3-stage gameplay/save and held-color tests passed, but the combined case stopped at its first x assertion, before y/cancel/performance. Its logs have no contact-time, simulation-time or pointer-event trace. The formal artifact download reference was acquired; file transfer into this environment returned403 and was not bypassed. No failed-image timer value is claimed. **The exact CI root cause remains unconfirmed.**

The old test waited200ms wall time. App frames cap elapsed simulation budget at100ms; fixed steps are1/120s, held-right speed5m/s. Rounded0.417m is ten steps/83.33ms. Render/main-thread scheduling can therefore advance too little simulation before the wall-time assertion. This is a demonstrated fragile test assumption, not proof that a specific long task caused the CI result.

[Probe source](probe.mjs)/[raw six-condition data](probe.json) cover public/candidate × normal/CPU8/one artificial220ms main-thread task, sequential native portal/start and pure CDP simultaneous contacts. Normal/CPU8 pass movement and jump; artificial load yields x0.167/y0.278 at fixed200ms on both variants while right+jump remain held. Continuing those contacts until game time advances yields public x0.833/y1.146 and candidate x0.750/y1.059. Both jump once and cancel stops movement. CPU8 did not reproduce a failure. Artificial load demonstrates a mechanism only.

[Clock-wait proposal source](proposal-validation.mjs)/[four-condition data](proposal-validation.json) verify the after-dispatch clock condition in normal/artificial-load public/candidate contexts. All4 pass movement/jump and cancellation; loaded variants reach x1.000/y1.302, whereas their retained fixed200ms snapshots are x0.167 and0.333. These diagnostics retain rAF snapshots, native pointer events, long-task observations and times; no held callbacks, physics writes or repeated passing-host selection. The diagnostic records the old200ms snapshot before applying the clock wait, whereas the updated test goes directly to clock polling.

The public preview was built from8714b3f; Amber app/model/render/art/test bytes match mainf110bd8, checked by git diff. Candidate was the approved runtime atc332f2b. Both Chromium151 SwiftShader,390×844,DPR1. Local previews4355/4354 are required to rerun the evidence scripts; browser dependencies must be installed normally.

Build, game TypeScript and Astro check (0 errors/0 warnings/6 hints,82 files) pass after rebase/fix. [Targeted existing browser log](browser.log)/[report](browser-report.json) pass2/2: combined touch/movement/jump/cancel/layout/performance/navigation and held-feedback case. [Performance](performance.json) is60.0017fps/p95 16.7ms on the unchanged300-frame gate. These are local checks, not full CI.

[Stopped-clock probe](stopped-clock.mjs)/[result](stopped-clock.json) starts and pauses through native buttons, then applies the same wait. The unchanged timer remains0.07 and the wait rejects with TimeoutError in3011ms, confirming a frozen game does not wait indefinitely. No state or clock injection.

Previous19/20 full-suite result and matched-public FPS failures remain in [approved QA](../approved-qa/README.md); this small synchronization change does not claim full CI is green. Parent dispatch of the new final SHA remains pending authentication. No merge or publication.
