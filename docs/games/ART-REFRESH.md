# In-game 3D art refresh

Base: published main `aa44ef3a2e6ab853f2c13a168e73dd0e56459907`. Branch: `codex/3d-art-refresh`. Independent review is required before merging; publication remains pending.

## Result and scope

Orbit Ribbon replaces the test cube with a Kenney speeder, adds segmented station decks, structural ribs, rock/meteor scenery, small distant docking platforms, a banded planet, satellite and continuous stars. Amber Step replaces the cube with animated Oodi, adds fitted grass blocks, flowers, trees and rocks on separate background islands, layered hills/clouds and a sunset sky. Both retain the existing cyan/amber gap edges and red hazard silhouettes. The camera, six stages, collision surfaces, jump/movement physics, input, v1 save key and bilingual UI are unchanged.

Opaque static meshes are merged by shading/side into vertex-color batches, including nested GLTF world transforms. Emissive hazard/gap cues remain separately instanced. A tested spatial-cell variant increased draw calls and was replaced; its measurements are retained. Material shading uses diffuse Lambert lighting. There are no shadows, postprocessing or CSS compositing additions. The existing 450,000-pixel/DPR limits remain unchanged. A low-resolution vertex-colored sky needs no image download. The flat palette PNG is sampled once into linear vertex colors (including UV transforms), preserving the official colors while removing per-fragment texture fetches. Closed models cull backfaces; open flowers/foliage retain both sides. Distant hills/clouds/sun use flat silhouettes and the space planet/rings use fewer subdivisions. Files are requested asynchronously per game; each failed model/texture leaves a playable procedural fallback. Art adoption does not mutate the model state or save.

## Official provenance and model inspection

The resolved Library candidate could not be materialized: the signed download host `sdmntprcentralus.oaiusercontent.com` returned HTTP 403 on the initial request and one fresh-URL retry. No local candidate ZIP/hash verification is claimed. The new environment successfully fetched the official pages and ZIPs at `kenney.nl` using the normal network. No mirror or network bypass was used.

[Public source manifest](../../public/games/assets/kenney/SOURCES.json) retains original archive URLs, exact archive SHA256/byte counts and SHA256/size for each shipped file. Both original License.txt files are distributed unchanged with the selected models: [Space Kit](../../public/games/assets/kenney/space/License.txt), [Platformer Kit](../../public/games/assets/kenney/platformer/License.txt). These are CC0 1.0 Universal. Only the nine adopted GLBs and one shared PNG are distributed; the full packs and unused astronaut are excluded. [Original previews and loaded-model inspection](evidence/art-refresh/source/) are review evidence and are not in the published build.

| Adopted asset | Bytes | Use |
| --- | ---: | --- |
| craft_speederA.glb | 20,496 | Orbit player |
| platform_small.glb | 6,280 | Orbit deck / distant station |
| meteor.glb | 6,496 | Orbit distant rock |
| rock.glb | 13,172 | Orbit distant rock |
| character-oodi.glb | 202,604 | Amber player |
| block-grass-low-long.glb | 10,200 | Amber ground |
| tree.glb | 42,680 | Amber background |
| rocks.glb | 9,556 | Amber background |
| flowers.glb | 25,928 | Amber platform edge |
| Textures/colormap.png | 11,140 | Shared Amber texture |

All imported files were parsed and drawn with the actual Three GLTFLoader before adoption. Space Kit's authored `(2,0,1.5)` scene offset is removed in a wrapper so its mesh centers match gameplay. Ground block world bounds determine the scaling; maximum top height and end faces match each platform's y/a/b. The ship faces -Z, the original Oodi +Z rotates to +X. Oodi contains 25 clips; idle/walk/jump/fall/die drive presentation with simulation elapsed time, so pause/recovery freezes pose progression. The animations do not move gameplay state. Original geometry/accessors and loaded world bounds/clip durations are retained in the source evidence.

## Verification and publication

Verification is in progress. Initial local desktop stage-3 measurements failed the unchanged >=45fps / p95<=40ms gate (Orbit 34.24fps/50.1ms; Amber 22.01fps/100ms). Both initial touch-emulated stage-3 runs passed at 47.50fps/33.4ms. Initial exact-SHA CI [37649611600](https://github.com/shou773/pocketey-portal/actions/runs/37649611600) failed all four frame gates and the Amber instantaneous jump assertion (15/20 Chromium pass); portal, cross-browser, types/build/model and missing-colormap fallback passed. This is not an Actions success. [Original Chromium log](evidence/art-refresh/initial-ci-63f61fd-browser.log). These results are retained; baseline comparison is required to separate environmental variation and actual regression. Do not infer release readiness from asset acquisition or a build pass.

After exact-candidate checks, image review and independent approval, use the existing main → GitHub Actions → GitHub Pages deployment. Verify exact merge/deployment SHA, live `pocketey.com` routes, model/texture/license response bytes, bilingual instructions, ordinary gameplay and v1 save/reopen. Historical Cloudflare checks remain distinct from this deployment. Physical iPhone performance for this version is unverified.

## Performance investigation

The [GPU probe](evidence/art-refresh/gpu-initial/) brackets each render with asynchronous timer queries from WebGL clear through the render task's microtask. Suppressing GL index-count bins is diagnostic only: a bin can include several objects, so it does not isolate an individual asset perfectly. On this software renderer, Amber initially used about 24.2ms of GPU time and 27.6fps; suppressing imported-mesh bins reduced it to about 11.0ms/54.3fps. The CPU/driver submission times in the paired comparisons are not asynchronous GPU execution times. Script/layout duration did not explain the large regression.

Initial Amber desktop submitted 46 calls/frame. Batching clouds reduced that to 29, but each hill still had a separate material. Sharing those colors reduced it to 13. Global static merging, flat distant silhouettes and fewer repeated decorations now submit **8 calls / 10,394 triangles** for Amber, **13 calls / 5,012 triangles** for Orbit at the initial comparison scene. The first candidate submitted 23,114 Amber triangles and 7,984 Orbit triangles; baseline submitted 2,156 and 2,408 respectively. Draw calls and triangle counts are submissions, not a count of visible fragments. [All alternating measurements, including failed variants](evidence/art-refresh/).

The final compact diagnostic has Amber desktop 44.2–46.4fps and Orbit desktop 43.3–48.6fps; baseline desktop spans 42.9–58.5fps in that run. Most phone samples are 59–60fps; one Orbit phone sample is 45.8fps, retained. These short initial-segment diagnostics are not release gates. Full ordinary-input stage-3 checks and exact-SHA CI are still required; no thresholds, mechanics or input timing limits were changed. One initial comparison's first pair overlaps the next candidate's build; that pair is retained as confounded and is not used alone to infer causality. Later comparisons were run after builds and other browser tasks finished.

Amber's animation test now records actual clip transitions before screenshot capture, releases movement, and asserts airborne jump/fall plus grounded idle/walk after landing. This fixes a test that waited through the jump while taking a screenshot; it does not delete the animation assertion or alter gameplay. [Targeted transition/fallback evidence](evidence/art-refresh/palette-targeted/).

The ship's rendered envelope is ~0.96 wide / 1.008 long; the legacy physical horizontal padding remains 0.4 total. Its main metal-dark hull is ~0.48 wide, with decorative wings outside it. This is a deliberately forgiving center-based collider, not full-mesh collision. Close-pass/hazard/gap gameplay images must be reviewed before release; normal all-stage completion and post-gate save/reload checks remain required.

Source model and gameplay/copy/input files retain their original bytes. Current selected downloads are 46,444 bytes for Orbit and 302,108 bytes for Amber (one shared PNG counted once). [Build inventory](evidence/art-refresh/payload.json) gives actual file sizes and theoretical gzip deltas; browser/CDN cache behavior and production transfer compression are separate measurements.

The quality workflow now includes this release document/evidence path so a final documentation/image candidate also receives checks on its exact head, rather than inheriting an older code SHA's run.
