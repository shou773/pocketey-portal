# Final Alpine atmosphere pass

Source: `d66bc9350f68b839a50941ca463d9ebd725fe22a`.
Only `src/games/prototypes/alpine/scene.ts` changed from the previously verified
art source. Road geometry, gates, input windows, collision, camera, models and
app behavior remain unchanged.

The final visual pass lowers the three distant ridges and gives each a broad
silhouette and a lighter blue at greater distance. A 1×128 procedural gradient
adds pale blue sky and a warm pink horizon. Warm input-zone overlays use 11%
opacity when inactive and 19% while active; their original bounds, line and
arrows remain. Cooler asphalt, brighter hemisphere light and a softer warm sun
separate road, car, ground and trees without adding scenery or rebuilding models.

The first composition review passed a full stage and retry. It showed that the
pink portion of the sky sat behind the mountains, so the gradient alone was
mapped to the visible upper fifth. The intermediate report is retained in
[intermediate-composition.json](intermediate-composition.json); its source hash
identifies the superseded local composition commit. The final built page then
passed the same full-stage run once. Neither run failed or used repeated
SwiftShader performance trials.

## Actual final WebGL evidence

- [Start](01-start.png)
- [After the first turn](02-first-turn.png)
- [Near the finish](03-near-finish.png)
- [Goal](04-goal.png)
- [Retry, with the full scene visible](05-retry.png)
- [Final result](complete-stage.json) and [capture script](complete-stage.mjs)

Chromium 151 / Three.js / SwiftShader, 390×844, ordinary wall clock. Four CDP
horizontal touch flicks (left, right, right, left) passed the four normal input
windows. The goal reached `z=50`, `gate=4`, and saved one clear. Clicking the
visible retry button reset the heading, gate and queued input. No page errors,
clock control, renderer interception, direct state writes or synthetic gameplay
API were used. Initial actual rendering: 47 draw calls / 8,274 triangles,
including the two-triangle sky. These are not physical-device FPS or latency
measurements.

With a production preview on port 4342, run:

```sh
node docs/prototypes/alpine/evidence/final-atmosphere/complete-stage.mjs
```

The script replaces the evidence files in this directory. Its saved report
identifies the source of the recorded run; update that identifier before using
it against later source revisions.

## Other checks

- [Model and scene tests](model-scene-tests.txt): 16/16 pass on the final source.
- [Type checking](types.log): pass.
- [Production build and portal route guard](build.log): pass.
- The earlier [six input regressions](../webgl-b5183d9/input6-report.json) passed
  at b5183d9. That suite uses a controlled clock and no-op renderer; it was not
  rerun for this visual-only pass. App, input and model files are unchanged.

The three requested actual views were inspected. Final subjective visual
acceptance belongs to the parent reviewer. Reference-image fidelity, physical
mobile devices, hardware FPS, input latency and audio listening remain
unverified. No Library save was retried after HTTP 401; no new Library ID,
publishing, deployment or merge is part of this delivery.
