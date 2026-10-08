# Orbit Challenger: rejected one-craft visual trial

**Decision: do not replace the current Kenney craft.** Challenger's authored nose, wings, canopy, paint and markings improve close-up detail, but at the unchanged phone size the detail disappears and its muted colors read darker. One final bounded material/texture pass did not materially improve phone readability. This draft preserves evidence only; runtime, public assets, physics, collision, controls, difficulty, camera, lighting and other games are identical to published main `9538edc3ff8e7c72362e4baab5b0f8331a2c49e8`.

| View | Existing Kenney | Final Challenger, Lambert + 512² |
| --- | --- | --- |
| Same close-up camera/lights/width/length | [Before](before-closeup.png) | [Trial](after-closeup.png) |
| Same phone game camera, 390×844 | [Before](before-mobile.png) | [Trial](after-mobile.png) |

## One final material/texture check

Original material was metallic=0, roughness=0 MeshStandardMaterial, without environment reflection in the existing scene. The final runtime trial converts only that material to MeshLambertMaterial with the same base-color map/color and side. Existing hemisphere/sun, fog and camera remain fixed. Geometry buffers are byte-identical across 2048² and 512² exports: no added polygons or silhouette changes.

[Original PBR/2048 phone](material-pass/pbr2048-mobile.png) · [PBR/512 phone](material-pass/pbr512-mobile.png) · [Final Lambert/512 phone](after-mobile.png).
[Original PBR/2048 close-up](material-pass/pbr2048-closeup.png) · [PBR/512 close-up](material-pass/pbr512-closeup.png) · [Final Lambert/512 close-up](after-closeup.png).

The Lambert pass changes some surface pixels but the phone view remains similarly muted; PBR-without-environment is not the sole cause. Original texture downsampling preserves the visible finish at this size. The phone craft-region PBR512/Lambert512 mean absolute RGB difference is approximately 0.38/0.38/0.32 on a 0–255 scale; this only quantifies this screenshot, not human perception or performance. No further aircraft search or redesign is pursued here.

## Cost

| Measurement | Existing ship | Challenger trial |
| --- | ---: | ---: |
| Ship triangles | 344 | 1,748 |
| Ship materials/draw calls | 2 | 1 |
| Model GPU vertices | 1,904 | 2,124 |
| Full stage-1 phone draws | 9 | 8 |
| Full stage-1 submitted triangles | 7,724 | 9,128 |

Texture export changed from **2048×2048 / 3,689,524-byte GLB** to **512×512 / 485,248-byte GLB**: 86.85% smaller. One embedded original base-color design, one material, no animation/rig/lights/camera. Nominal decoded RGBA plus full mip chain drops ~21.3 MiB to ~1.33 MiB, excluding driver overhead. No FPS/device improvement is claimed. Rejected model binaries and original downloads are retained privately outside the repository; this draft adds no model to the product.

## Honest capture and checks

Actual production bundles on local HTTP, native touch start, held first animation callback solely to capture identical x=y=z=0 states. No physics state or camera injection. Both phone canvases are 390×690, DPR1. Close-ups isolate the runtime-adopted materials under the same fixed existing hemisphere/sun and same inspection camera; they are labelled separately from game views. All final captures have zero page errors. Initial Vite dev captures with duplicated Three module instances were discarded. No access/authentication/certificate warning was bypassed.

Trial TypeScript, production builds/portal checks, normal touch start/progress/pause/resume and aborted-model Kenney fallback passed. [comparison.json](comparison.json), [smoke.json](smoke.json) and [identical-geometry/export record](material-pass/verification.json) retain results. Original PBR records remain under `material-pass/`. No full-stage/audio/save/cross-browser/FPS, long CI, merge or publication was requested or performed.

## CC0 provenance

Author: Quaternius. Exact original **Ultimate Spaceships – May 2021**, selected Challenger only.

- [Author's CC0 download page](https://opengameart.org/content/lowpoly-spaceships-pack)
- [Exact ZIP](https://opengameart.org/sites/default/files/ultimate_spaceships_-_may_2021.zip)
- ZIP SHA256 `ab7a725a2a1066d1f4c01fe27b2135f6138ca0b8a0a709eb9469957d26777670`, 103,093,231 bytes.
- [Dated source-page capture](source-page.html) and [original/used file hashes](provenance.json).

ZIP contains no license/readme document. Its specific author download page designates CC0; parent authorized that basis after checking the distinction from current QAL releases. No new edition was substituted and no contradictory notice was found. The captured page/provenance are project-added evidence, not documents originally bundled in the ZIP. This records the source's permission statement, not an independent legal guarantee of ownership. No copied CC0 text is represented as original archive content.

## Local reconstruction

`convert.blender.py` opens the original Challenger.blend and takes a private extraction root after `--`. It uses `extracted/Ultimate Spaceships - May 2021/Challenger/Textures/Challenger_Green.png`, downsamples in Blender, reloads the saved 512² PNG for export, turns the authored -Y nose 180° to runtime -Z, centers and normalizes width .80/length .84. UVs/normals and the source mesh remain intact. It outputs `served/challenger.glb` under that private root.

In an isolated candidate worktree, apply `runtime-trial.patch`, copy the converted GLB to its referenced public path, and temporarily copy `review.astro` to `src/pages/orbit-review.astro`. For baseline use the review template's existing-craft branch; it reads the baseline art helpers. Build candidate/baseline, serve their `dist` at 4352/4353, then run `node docs/release/orbit-quaternius/capture.mjs`. The smoke script uses port4352. Temporary routes/model files and runtime edits were removed from this evidence-only draft. Do not deploy the reconstruction or treat the rejected trial as approved.
