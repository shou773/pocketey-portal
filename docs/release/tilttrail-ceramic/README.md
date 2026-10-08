# TiltTrail: final ceramic sky candidate

The parent accepted the whole-view direction on2026-10-08. This candidate applies it to the renderer against public main `9538edc3ff8e7c72362e4baab5b0f8331a2c49e8`. Production differences are only render.ts and wind-rock.glb. The existing public observatory.glb is byte-identical; the rejected homemade rooted-observatory.glb is removed from public assets. No Quaternius assets, plants or new dependencies are distributed. Historical experiments remain here as evidence, not production code.

[Final normal smartphone image](evidence/final-native-mobile.png),390×844. Exact-state public [before](evidence/before-matched-mobile.png) / final [after](evidence/final-matched-mobile.png):stage0 t=3s/brake=true/steer=0, canvas390×694/framebuffer367×653. Normal screenshot times are bracketed in final.json, not claimed frame-exact. The parent-approved initial images/patch remain historical; renderer.patch is updated to the final source, preview-renderer.patch retains the initial local proposal.

The public observatory sits on the rounded original rock. Six x/z anchors remain unchanged. Rock has128 triangles,66 GPU vertices,1 connected component,0 non-manifold edges,1 material/primitive,0 textures and4376 bytes. It was reduced from140 triangles to keep the worst desktop scene with the brake ring below6000 triangles. Crown height remains1.3 and arches rest at y=-4.8 after rock load. While rock loading fails/is pending, original coarse islands and arch height y=-6.1 remain coherent. Scenery never supplies gameplay support.

One static256×512 painted sky has a quiet gradient, three broad softened clouds and two faint distant silhouettes. A2-triangle background quad samples its already-sRGB pixels directly, avoiding expensive repeated color conversions or transparent-canvas compositing. No extra light, shadow pass, decoder, postprocess or per-frame texture update. Matte rocks, lightly jointed cream ceramic road, shaded sides and glossy teal ball stay distinct. Road top/side positions, normals AND indices are byte-identical for all3 stages; camera position/orientation/projection and model states are also identical. Input, physics/collisions, levels/difficulty, audio/saves, shared UI, other games, dependencies and CI configuration are unchanged.

The upper sky is darker behind the small white HUD lettering. Nominal color contrast against that band is5.13:1 for small text and7.31:1 for main text; these are color-pair values, not a claim about every anti-aliased pixel. I inspected final normal play: HUD lettering remains readable, copper falling edges are visible, and cloud/silhouette decoration remains behind the road without supplying a false landing surface.

## Final targeted validation

- TypeScript, production build and portal guard pass.
- The existing unchanged ordinary multi-touch test passes on production preview: all3 stages clear, bests persist independently, reload retains them, other-game sentinel is untouched, page errors are empty. See functional-report.json, mobile-functional-completion.json and touch-stage1/2/3.json. Stage images are explicitly paused screenshots from that existing test, not normal-play claims.
- Final native stage3 sample:60.0007FPS, p95 16.7ms,10 calls/5628 triangles. Thresholds remain45FPS,40ms,16 calls and strictly fewer than6000 triangles.
- Final GLB failure cases (rock, observatory, both) all remain playing with zero page errors. When both fail, the public coarse fallback renders at13 calls/4200 triangles. See fallback-check.json and fallback-both-mobile.png.
- geometry-check.json compares top/side geometry and camera across all3 stages. Reproduction helpers and optimize-rock.py are included; no repository tests or thresholds were edited.

Worst fixed scene is stage3 t=3s with brake ring visible. The short comparison uses alternating baseline/candidate order, one active renderer at a time,3 rounds/mobile+desktop,200 frame samples per row (first20 omitted), unchanged camera/state/framebuffer. All samples are retained in render-benchmark.json.

| Worst scene medians | Public before | Final candidate |
|---|---:|---:|
| Mobile FPS / p95 |59.6698 /16.8ms|59.6718 /16.8ms|
| Desktop FPS / p95 |59.3433 /16.8ms|58.6969 /16.8ms|
| Mobile calls / triangles |10 /5530|11 /5676|
| Desktop calls / triangles |12 /5830|13 /5976|

Desktop median FPS is slightly lower (about1.1%); p95 is unchanged. This short SwiftShader diagnostic does not prove zero regression or physical-device performance. No thresholds are waived. Full ordinary all-stage/cross-engine/audio CI remains the parent's one final-SHA run; no merge or publication has occurred.

## Earlier diagnostics

Rejected-webgl-background-* records contain the initial expensive background conversion and a failed ordinary touch run (stage2 fall, max observed sample gap1.45s). That failure is retained and not counted as a pass. The earlier development-toolbar attempt was aborted and excluded; final functional runs use production preview. Rejected-css-background-benchmark.json records the transparency workaround's desktop slowdown. Intermediate-shader-background-build-overlap-benchmark.json includes a concurrent build and is not acceptance evidence. Pre-budget-shader-benchmark.json uses the140-triangle rock, which reached6000 desktop triangles before the brake ring and was rejected. Final validation uses the128-triangle rock and raw display-space sky quad. See validation.json for exact renderer/asset hashes and final measurements.

Reproduce with final dev4370, final production preview4371 and public baseline dev4361. Run capture.mjs final, geometry-check.mjs, fallback-check.mjs, render-benchmark.mjs, and NEW_GAME_EVIDENCE=docs/release/tilttrail-ceramic/evidence npx playwright test --config docs/release/tilttrail-ceramic/local.config.ts --grep 'ordinary multi-touch'. Build and type checks use the repository's existing commands.
