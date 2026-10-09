# Actual WebGL review of b5183d9

These are actual Chromium/Three.js screenshots of commit
`b5183d9835b7b9c2ddbbbbd0e371c7a22639e5f0`, captured in the working conveyor
review environment. No game source was changed. The browser uses the same
existing launch settings as the conveyor review; no OS, TLS or permission
settings were loosened.

The first bounded review used the ordinary wall clock, real WebGL through
SwiftShader, no renderer interception, and CDP touch events. It verified initial
rendering, a left flick queued in the valid zone, the first 45-degree turn,
pause/resume and 320×568 UI bounds. It did not claim a complete-stage clear,
hardware performance, FPS, physical-device input latency or reference fidelity.

- [Initial screen](01-ready-webgl.png)
- [Left flick queued](02-flick-queued-webgl.png)
- [After the first turn](alpine-pr23-webgl-check.png)
- [Narrow pause screen](03-narrow-paused-webgl.png)
- [Machine-readable report](review.json)

This resolves the previous environment's browser-launch blocker for this
receiving environment. Earlier Blender previews remain auxiliary evidence.

## Full stage and retry

One additional run completed the entire stage with the same actual WebGL build
and ordinary wall clock. Four CDP touch flicks (left, right, right, left) were
sent when the UI reported its normal input window. All four gates passed;
the goal reached `phase=clear`, `z=50`, `gate=4` and saved one clear. Clicking
the visible retry button returned to playing with gate 0, straight heading and
no queued turn. There was no renderer substitution, controlled clock or direct
input/state mutation, and no page error. This was one attempt, not a repeated
failure-until-success run. Its 16,430 ms wall duration is not an FPS measurement.

- [First turn](04-full-run-first-turn.png)
- [Near the goal](05-full-run-near-finish.png)
- [Goal and saved clear](06-full-run-goal.png)
- [Retry](07-full-run-retry.png)
- [Full-stage report](complete-stage.json)
- [Capture script](complete-stage.mjs); only dependency/output paths and an
  optional origin were made portable after capture. The actions are unchanged.

With the built page served on port 4342, the script can be run from the checkout
using `node docs/prototypes/alpine/evidence/webgl-b5183d9/complete-stage.mjs`.
It writes fresh evidence in this directory; the saved report identifies the
source commit of the recorded run.

## Separate input regression suite

All six unchanged `tests/prototypes/alpine/input.spec.ts` tests passed, with zero
retries. They use a controlled clock and intercept only the renderer module
with a no-op view. They verify input/app/model/UI/storage behavior, not actual
WebGL rendering. The receiving-environment wrapper changed only the server to
port 4343, the report paths and Chromium launch options to the same working
flags recorded in `complete-stage.json`.

- [Six-test JSON report](input6-report.json)
- [Console log](input6-run.log)

The console log retains Vite allow-list errors for Astro's development toolbar:
the temporary dependency symlink resolved outside the car worktree. The toolbar
resource did not load; all six game tests passed. No filesystem allow-list was
expanded. The dependency symlink was removed after the run.

Actual device performance, input latency, Safari/Firefox, audio listening and
reference-image fidelity remain unverified. No game source or visual styling
was changed by this review. A Library save attempt failed at helper discovery
with HTTP 401, before upload preparation; no further save was attempted. These
new actual screenshots are preserved in the PR, with no new Library ID.
