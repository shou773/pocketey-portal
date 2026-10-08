# Amber Step — visual review checkpoint

The visual direction and [two-point contact/gap revision](contact-review/README.md) are now approved by the parent. [Approved revision integration QA](approved-qa/README.md) supersedes the pending-check status below and retains both positive results and unresolved FPS/CI gates. The historical checkpoint remains unchanged for traceability.

Base: public main `a443ec37c33cae22021c82b7b20f3fb6e62f02c6`. Branch: `codex/amber-step-depth`. This is a draft visual candidate. Merge, publication, full all-stage browser/cross-browser CI and physical-device verification are pending visual approval.

The snapshot below records `258e880`. The subsequent [two-point contact/gap revision](contact-review/README.md) supersedes its scenery images and draw counts. Performance for that revision is pending; the earlier low sample is preserved below.

## Result and scope

The original long green deck and rectangular underside become a cream sandstone surface with warm strata and a tapered underside. Sparse sage shrubs, pink/lavender mesas, distant canyon walls, restrained clouds and a chamfered rock arch form an original sunset sandstone garden. The existing licensed Oodi, its animation/rig, contact shadow and sunset remain. Native warning edges and red spikes retain their positions and geometry. Platform shrubs have at least1.4m center clearance from gap endpoints and1.6m from spike centers; near background mesas are lowered to avoid suggesting intermediate landings inside gaps. No collectible or other mechanic is introduced.

Only Amber-specific scenery and its branch in the existing renderer change. Platform a/b/y, visual width 3.4, camera, stage layouts, collisions, movement, difficulty, input, audio, saving, common UI, dependencies, workflows and other games retain their code. The new top retains the old full length and maximum elevation, with small corner chamfers like the former model; only the non-colliding underside tapers. The physical platform width remains the existing forgiving width 7, wider than both the former and candidate rendered decks.

The static opaque scenery uses existing vertex-color/fog batches. No shadow map, extra light, texture, postprocessing or pixel-budget change is added. Temporary platform geometries are disposed after batching. Background shapes and materials are reused. The final stage-1 images submit **10 calls / 6,918 triangles**, versus **11 / 7,034** at main: one fewer call and116 fewer triangles. Both use buffers 390×690 in 390×844 portrait and 844×341 in 844×390 landscape at DPR1.

Amber's existing selected Kenney requests total302,108 bytes including the shared palette. The arch adds13,520 bytes; currently unused Kenney scenery requests are retained in the unchanged shared loader rather than altering that loader in this review.

## Official reference and original Blender asset

The parent research supplied observations from Nintendo's [Super Mario 3D World + Bowser's Fury official overview](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Super-Mario-3D-World-Bowser-s-Fury-1832228.html) and its [official screenshot](https://www.nintendo.com/eu/media/images/08_content_images/games_6/nintendo_switch_7/nswitch_supermario3dlandandbowsersfury/SuperMario3DWorld_BowersFury_Overview_meowvlous_carousel_img_02.jpg): broad readable surfaces, tangible thickness, simple terrain, contact and front/back separation. The official overview was accessible in this task. The screenshot observations are attributed to the parent's research; no fresh local original-image inspection is claimed. No Nintendo mesh, texture, character or distinctive object was downloaded into the candidate.

Blender 4.3.2 was already available. Its use is limited to the prominent arch, where a dedicated chamfered silhouette and broad vertex-painted strata improve the plain procedural extrusion. [Generator](create-arch.py), [editable Blender source](stone-arch.blend), [export log](blender-export.log) and [shipped provenance/hash](../../../../public/games/assets/amber/SOURCES.json) are included. The GLB is 13,520 bytes, one mesh, one material, 172 triangles, no texture. Draco was unavailable; the ordinary uncompressed export succeeded. An asynchronous ordinary GLTFLoader request adopts and batches the model, with `data-amber-landmark=blender` recorded in final captures. A failed model request leaves the procedural arch playable. Existing Kenney downloads and licenses are unchanged.

## Same-play images and motion review

| Native-input view | Main | Final Blender candidate |
| --- | --- | --- |
| 390×844 start | [Before](before/390-start.png) | [After](after/390-start.png) |
| 390×844 gap, x=8.750 | [Before](before/390-gap.png) | [After](after/390-gap.png) |
| 844×390 start | [Before](before/844-start.png) | [After](after/844-start.png) |
| 844×390 gap, x=8.750 | [Before](before/844-gap.png) | [After](after/844-gap.png) |
| Stage3 390×844 uphill gap | [Before](before-stage3/390-gap.png) | [After](after-stage3/390-gap.png) |
| Stage3 390×844 edge spike / lower landing | [Before](before-stage3/390-edge-spike.png) | [After](after-stage3/390-edge-spike.png) |
| Stage3 844×390 edge spike / lower landing | [Before](before-stage3/844-edge-spike.png) | [After](after-stage3/844-edge-spike.png) |

[Capture source](capture.mjs) starts through the native button, holds ArrowRight, presses Space at frame26, and drives the existing rAF loop at 60Hz. Screenshot-time callbacks are held; no physics state is written. All captured x/y/grounded/jump states and buffers match between main and candidate. These are actual production-preview canvas/page renders, with no development toolbar, resizing or generated replacement imagery. [Main diagnostics](before/capture.json) / [candidate diagnostics](after/capture.json) retain shader/runtime errors and model-adoption status.

The same 105-frame play also captures [takeoff approach](after/390-motion-026.png), [rising over the spike](after/390-motion-038.png), [near the apex](after/390-motion-053.png) and [landed](after/390-motion-083.png). Matching before and landscape sequences use the same filenames. These rendered frames were inspected: idle/walk/jump motion, white character silhouette against the low tree/arch, visible red spike, contact shadow and next cream landing surface are distinguishable. The first jump reaches x4.417/y1.691; the landing is x6.917/y0, then the gap is x8.750/y0. A brief overlap with the low background tree occurs during the rising frame; it does not hide the head or spike. No new effect is added. Existing landing-cue lifetime is unchanged at220ms; the sparse frames do not independently verify every millisecond of its fade.

Stage3 uses an existing-v1-save unlock fixture and native stage selection. It captures the first uphill gap at x8.750/y0 and edge-spike/downhill-gap combination at x17.833/y.700 after a native jump across the first gap. Both endpoints and next cream landing surface were inspected in portrait and landscape; plants leave the spike and final takeoff region clear. Main submits11 calls/8,690 triangles here; the candidate10/7,902. No stage3 completion is claimed.

Additional native-input observations use the same stage3 run:

- [Stopped/checked](after-stage3-stop/390-stopped.png): x17.833/y.700 remains fixed for30 simulated frames with movement released. A native movement+jump then crosses the edge spike at [x19.333/y2.322](after-stage3-stop/390-combo-rising.png) and [lands at x23.083/y0](after-stage3-stop/390-combo-landed.png). [Diagnostics](after-stage3-stop/capture.json) include both orientations.
- [Early departure](after-stage3-early/390-early-descending-approach.png): a jump from x16.000 descends into the edge spike, dying at x19.625/y1.232. [The actual first failed 3D canvas frame](after-stage3-early/390-failure-canvas.png) shows the contact independently of the native retry overlay; [full-page result](after-stage3-early/390-failure.png) and [diagnostics](after-stage3-early/capture.json) are retained.
- [Late departure approach](after-stage3-late/390-late-approach.png): the jump near x18.667 hits while rising, dying at x18.792/y.911. [Actual first failed 3D canvas frame](after-stage3-late/390-failure-canvas.png), [full-page result](after-stage3-late/390-failure.png) and [diagnostics](after-stage3-late/capture.json) are retained.

The failed canvas PNGs are copied synchronously from the actual WebGL render immediately after the native game callback, with no UI/game-state changes, so the retry panel does not obscure the contact. The full native result panel has generic retry advice and does not explicitly explain early versus late timing. Approach/failed render frames plus read-only positions distinguish those cases; the result panel alone does not. These few observations cover continuous initial movement and stop/check/jump across one combination, not human difficulty suitability or every stage3 combination. Coyote0.1s and jump buffer0.13s retain their original bytes in model.ts.

No video was recorded/replayed or physical phone operated. Deterministic browser input/render sequences and emulated touch checks are the available evidence, and do not establish human difficulty or real-device feel. No new unfair failure was observed in the covered first jump/gap; all-stage play and difficulty evaluation remain separate.

[Earlier procedural candidate](procedural/) is retained to compare the Blender arch with the initial U-shaped extrusion. Its stage-1 count was10 calls/6,998 triangles. The Blender adoption cost48 net extra triangles after reducing cloud subdivisions. Final spike-clearance cleanup removed128 more triangles. Intermediate images precede this clearance/background-height cleanup.

## Checks and performance

Game TypeScript, production build/route checks and24 model tests pass. Astro check recorded0 errors/0 warnings/9 hints. [Final targeted report](targeted-report.json) and [log](targeted.log) record3/3 passing existing browser cases: GPU-bound animated poses and native input/pause, failed Kenney GLBs with ordinary touch completion/save/reload, and missing colormap with ordinary touch completion. These tests ran on production preview at4344 after Blender adoption, before the final shrub-clearance/background-height cleanup. The cleanup was subsequently checked with game TypeScript, build and native-input stage3 frame captures; their exact temporary [config](review-config.mjs.txt) is retained.

[Custom-arch failure probe](landmark-fallback.mjs) also aborts only the new GLB request: [diagnostics](landmark-fallback.json) and [native movement/jump image](landmark-fallback.png) show the procedural landmark fallback, running state, x/y movement and no runtime exception. This short probe does not claim stage completion.

The earlier development-server run passed animation but both touch completion cases remained at x0 and failed; [raw report](development-targeted-report.json) and screenshots are retained. Changing only to production preview resolved both before the Blender adoption. The development toolbar was present in those pages; it was not part of the shipped game. The development run is not reported as passing. [Procedural production report](procedural-targeted-report.json) also passed3/3 before Blender adoption.

[Performance source](performance.mjs) runs3 declared alternating rounds on isolated main/candidate production previews at4345/4344, sound enabled, equal pixel buffers, fresh contexts, first10 callbacks excluded, with every raw interval retained. Each sample covers the stationary first1500ms after native start; this is a short rendering diagnostic, not the all-stage stage3 release gate. [Final production comparison](performance/comparison.json), [procedural production comparison](performance/procedural-comparison.json) , [Blender before clearance](performance/blender-before-clearance-comparison.json) and [earlier development comparison](performance/development-comparison.json) are separate. One final diagnostic was stopped because another browser test was concurrently running; [its incomplete raw log](performance/concurrent-incomplete.log) is retained and is not used for performance conclusions. The final diagnostic runs alone after targeted tests complete.

| Final isolated diagnostic | Main fps | Candidate fps | Main p95 ms | Candidate p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Desktop round0 | 55.14 | 54.62 | 33.4 | 33.3 |
| Desktop round1 | 54.09 | **42.26** | 33.3 | 33.4 |
| Desktop round2 | 55.32 | 55.84 | 33.3 | 33.3 |
| Mobile round0 | 56.30 | 60.00 | 16.8 | 16.7 |
| Mobile round1 | 60.00 | 60.00 | 16.7 | 16.7 |
| Mobile round2 | 59.26 | 59.26 | 16.8 | 16.8 |

All12 samples are valid and retained. Candidate desktop round1 is42.26fps, below the45fps release minimum; this is an unresolved low diagnostic and is not called a passing performance check. The other desktop pairs are close. The pre-clearance Blender comparison was53.51–56.11fps for candidate versus45.00–56.72 for main, and remains separately available. These short software-rendered samples do not establish whether the low final sample is host variation or a regression. No unchanged rerun is used to replace that result; visual approval precedes the existing full stage3 gates and a baseline comparison on the exact final head.

SwiftShader results do not establish physical iPhone performance. Existing >=45fps/p95<=40ms release assertions remain untouched. Full exact-head CI, all-stage input/save/recovery checks and independent approval must precede the parent's sequential integration and deployment. The new branch is not in the workflow's automatic push branch list; after visual approval the parent can dispatch the existing `Games quality` workflow against its exact head without changing workflow configuration.

## Reproduce the visual checkpoint

Install with `npm ci --cache /tmp/amber-npm-cache`; this environment's default user cache was not writable. Build main in an independent checkout and serve its production preview on4345; build the candidate and serve preview on4344. From the candidate root run:

```sh
AMBER_BASE_URL=http://127.0.0.1:4345 node docs/games/evidence/amber-depth/capture.mjs before
node docs/games/evidence/amber-depth/capture.mjs after
AMBER_STAGE=3 AMBER_BASE_URL=http://127.0.0.1:4345 node docs/games/evidence/amber-depth/capture.mjs before
AMBER_STAGE=3 node docs/games/evidence/amber-depth/capture.mjs after
AMBER_STAGE=3 AMBER_CASE=stop node docs/games/evidence/amber-depth/capture.mjs after
AMBER_STAGE=3 AMBER_CASE=early node docs/games/evidence/amber-depth/capture.mjs after
AMBER_STAGE=3 AMBER_CASE=late node docs/games/evidence/amber-depth/capture.mjs after
# Run with no other active browser job:
node docs/games/evidence/amber-depth/performance.mjs
blender --background --python docs/games/evidence/amber-depth/create-arch.py
```

No Library upload, credential bypass, access-control workaround, merge or deployment was performed.
