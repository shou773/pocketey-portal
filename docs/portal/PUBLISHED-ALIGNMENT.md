# Cover alignment after Amber and Tilt publication

Published main: `1e071902bda809c4e0beaabffe7ebb81b99e4342`. Orbit integrated candidate: `2edb47c0d72b2446b5fe110486d1a39828309dcc`. The approved cover PNGs, title SVGs and portal HTML/CSS remain unchanged. Only provenance and verification evidence are updated.

## Model and scene comparison

| Cover | Comparison result |
| --- | --- |
| Amber Step | Shared renderer, scenery module, art loader, stage/model data and character GLB and Blender arch GLB are byte-identical between the cover reference `2bde0bc` and published main. The cover's thick platforms, jumping character, grounded arch supports and canyon are actual published geometry. Explicit Blender loading and byte-identical regeneration are verified below. |
| TiltTrail | Ball renderer and model are byte-identical between reference `6339f1c` and published main. The striped ball, turning road, observatory and its island are unchanged. The cover's observatory placement is an already declared introduction composition. |
| Pulse Drift | The only view change since reference `8714b3f` is the collision core staying visible during damage, plus its comment. Ship, enemies, projectiles and environment geometry are unchanged. The staged cover already explicitly omits that collision indicator. |
| Orbit Ribbon | Orbit art module, art loader, stage/model data, speeder GLB and Blender relay GLB are byte-identical between reference `9a066c7` and integrated candidate `2edb47c`. The shared renderer diff integrates Amber scenery and does not change Orbit's ship, runway, obstacles or draw branch. |

[Exact source/blob comparison](evidence/published-alignment/model-alignment.json), [Pulse view diff](evidence/published-alignment/pulse-view.diff), [Orbit shared renderer diff](evidence/published-alignment/orbit-shared-renderer.diff).

**Correction:** The previous claim that the cover reference lacked `stone-arch.glb` and used a procedural fallback was a verification error. Both reference `2bde0bc` and published main contain the same Blender GLB blob `aa1607ddd43558ec812dbd9ab43903bcf14de470`. The cover was regenerated from published main with an explicit wait for `amberLandmark=blender`, observing GLB HTTP 200 and art ready. The regenerated PNG is byte-identical to the approved cover (SHA-256 `8ca3029ac6abdc4da59fbe91e6ecdf3e1a7113fb6ec3ca946305fc5892b1bf7e`), proving the approved cover already uses the normal published Blender arch. No visual replacement or other design change is needed. [200px comparison](evidence/amber-blender/comparison.png), [load and image verification](evidence/amber-blender/verification.json), [capture scene](evidence/amber-blender/cover-composition.json).

## Latest-main preparation and focused checks

The portal head `9da0d19` combines without conflicts with published main `1e07190`: tree `e96cd53534cda78104e5c60b7369073fa3c53506`. Its contents were archived into an isolated temporary directory and tested without merging either branch.

- [Production build](evidence/published-alignment/build.log) and route/retirement guard: pass.
- [Nine focused portal checks](evidence/published-alignment/portal-focus.log): 9 passed in 35.5s. Both portal routes and languages across 320–1440px, keyboard focus/activation, caption/play contrast, language navigation and retention, real internal links, and all four public game metadata checks pass against the new main content.
- No game playback, performance or long CI suite was manually repeated. Earlier broader [final validation](FINAL-REVIEW.md) remains available.

Remaining gate: Orbit publication and parent final approval. PR #17 remains a draft; no merge, publication or Library retry was performed. The approved design remains intact.
