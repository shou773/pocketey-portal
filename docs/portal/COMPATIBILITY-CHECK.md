# Published portal test compatibility

Base: published main `930e1c74392f87b201e2e610faabcd8380faf628`.

## Mobile navigation

Games quality [run 37762158935, quality job 113260952149](https://github.com/shou773/pocketey-portal/actions/runs/37762158935/job/113260952149) waited for a header link hidden by the compact mobile portal. The test now asserts visibility and normally clicks the existing footer “ゲーム一覧” link. It checks the Japanese games-list destination, opens Amber, retains simultaneous native touch/cancel, FPS and layout checks, then uses the visible game-bar wordmark to return to all four games and the portal brand to return home. No force clicks or removed assertions.

## Missing-colormap failure investigation

The same CI job's Amber fallback case died at `x=3.375`, `y=0.211`, `jumps=1`. That case did not record input timings, so its historical delivery latency cannot be measured from the available logs. Unchanged game source alone does not establish the cause.

Focused experiments against the published build, with missing colormap requests aborted:

| Controller | Artificial first-jump delivery delay | Result |
| --- | ---: | --- |
| Existing | 0 ms | Clear, nine jumps |
| Existing | 200 ms | Dead: `x=3.375`, `y=0.211`, one jump; matches CI state |
| Existing | 250 ms | Dead before jump acceptance: `x=3.375`, `y=0`, zero jumps |
| Settled native jump | 0 ms | Clear, nine jumps |
| Settled native jump | 200 ms | Clear, nine jumps |

In the matching 200 ms experiment, the decision read `x=2.083`; the native pointerdown arrived at `x=3.250`. Only three 1/120 s physics steps remained before the first hazard, explaining the low `y=0.211` collision. This demonstrates a delivery-latency failure mode compatible with CI, **not a measurement of the original CI delay**.

For the missing-colormap case only, the input helper now releases movement, sends the native jump, observes the real jump count (and sufficient height before a spike), then resumes movement. The game keeps running normally throughout. Ordinary gameplay and performance controllers keep the default behavior. Physics, assets, difficulty, save/audio, runtime, dependencies, CI configuration and FPS gates are unchanged. Clear remains required.

The fallback case now writes input decision/completion times, read-only native pointerdown observations and final game state on success or failure. Condensed raw observations are committed in [COMPATIBILITY-EVIDENCE.json](COMPATIBILITY-EVIDENCE.json). Full local traces/logs are in ignored `live-evidence/portal-compatibility/`.

To reproduce the diagnostic experiment without changing the game, temporarily wrap the test's `page.context().newCDPSession` and its returned `session.send`. Before forwarding the first `Input.dispatchTouchEvent` with `type: 'touchStart'` and jump touch point `id: 3`, wait 200 ms in the Node test process. Forward the original method and parameters unchanged, and leave all later sends untouched. Run only the missing-colormap test. The artificial delay wrapper was removed after the experiments and is not part of this change.

## Validation

- `npm run test:browser -- --grep 'touch simultaneous move\+jump, touch cancel|missing shared colormap'`: **2 passed**. Retained performance assertions: **58.20 fps**, **p95 16.8 ms**, versus gates 45 fps / 40 ms.
- The missing-colormap test with a temporary 200 ms first-jump delay: **1 passed**, clear with nine jumps.
- `npm run check:games`: passed.
- No full gameplay suite was manually rerun. Known Amber stage-three CI performance failure is outside this test compatibility change and remains unresolved; no threshold was relaxed.

This branch is for review as a draft PR; it has not been merged or published.
