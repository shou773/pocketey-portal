# In-game 3D art refresh

Base: published main `aa44ef3a2e6ab853f2c13a168e73dd0e56459907`. Branch: `codex/3d-art-refresh`. Independent review is required before merging; publication remains pending.

## Result and scope

Orbit Ribbon replaces the test cube with a Kenney speeder, adds segmented station decks, structural ribs, rock/meteor scenery, small distant docking platforms, a banded planet, satellite and continuous stars. Amber Step replaces the cube with animated Oodi, adds fitted grass blocks, flowers, trees and rocks on separate background islands, layered hills/clouds and a sunset sky. Both retain the existing cyan/amber gap edges and red hazard silhouettes. The camera, six stages, collision surfaces, jump/movement physics, input, v1 save key and bilingual UI are unchanged.

Static imported meshes are instanced by shared geometry/material, including nested GLTF world transforms. Material shading uses diffuse Lambert lighting. There are no shadows, postprocessing or CSS compositing additions. The existing 450,000-pixel/DPR limits remain unchanged. A low-resolution vertex-colored sky needs no image download. Files are requested asynchronously per game; each failed model/texture leaves a playable procedural fallback. Art adoption does not mutate the model state or save.

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

Verification is in progress. Initial local desktop stage-3 measurements failed the unchanged >=45fps / p95<=40ms gate (Orbit 34.24fps/50.1ms; Amber 22.01fps/100ms). Both touch-emulated stage-3 runs passed at 47.50fps/33.4ms. These results are retained; baseline comparison is required to separate environmental variation and actual regression. Do not infer release readiness from asset acquisition or a build pass.

After exact-candidate checks, image review and independent approval, use the existing main → GitHub Actions → GitHub Pages deployment. Verify exact merge/deployment SHA, live `pocketey.com` routes, model/texture/license response bytes, bilingual instructions, ordinary gameplay and v1 save/reopen. Historical Cloudflare checks remain distinct from this deployment. Physical iPhone performance for this version is unverified.
