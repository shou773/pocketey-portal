# Orbit PR22: bounded comparison, 2026-10-08 UTC

**Not ready to approve or publish.** Saved PR22 `09531213a46a24db850faab91ac44a8ed33d26c4` and current published-main source `7adf12ab464cfbb8e9d4e04917ad9f618a1a5f4b` each received exactly **one** native-touch stage3 attempt. Both died at the first obstacle. No retry, all-stage suite, long CI, physics/difficulty/camera/harness change, Blender simplification, PR22 update, merge or deployment.

This evidence is saved on new branch `verify/orbit-shutter-limited-20261008`, rooted at the definitely saved 09531213. Existing main/Pulse workspace was not changed. Both production builds and their portal checks passed. Source comparison confirmed `src/games/model.ts`, `src/games/app.ts` and `tests/games/input.ts` identical between tested revisions. The saved model remains **588 triangles / 47,956 bytes**, SHA256 `10b1635e512fe27497491e26b84ec0d03079c566507bf522dae55e457eafc2d2`; this is not a recovered 384-triangle version.

## Draw comparison first

Stage3 has 11 obstacles, more than stages1/2. Full-stage static batching means these counts include geometry outside the visible camera. Menu selection loaded stage3 normally; counting did not start a gameplay attempt. Same390×844 viewport/DPR1,390×690 framebuffer.

| Local build of source | Draws | Submitted triangles |
| --- | ---: | ---: |
| Published main 7adf12ab | 9 | 8,700 |
| Saved PR22 09531213 | 9 | 14,244 |

Increase5,544 (+63.7%), exactly11×(588−84). No Orbit-specific triangle ceiling was found in existing tests/docs. Existing gates are FPS≥45 and p95≤40ms. A count increase alone does not establish a breach or justify a hidden-face rewrite, so no model modification was made before the requested two single attempts. The later short play samples fail performance on **both** builds and cannot attribute the cause to the candidate.

[Raw draw comparison](draw-comparison.json) · [Published stage3 menu](published-stage3-menu.png) · [Candidate stage3 menu](saved-pr22-stage3-menu.png)

## Exactly one native-touch stage3 attempt per build

Unmodified `tests/games/input.ts` ran with native CDP touch delivery, ordinary game animation frames and normal stage3 UI selection/start. Both contexts received the same valid pre-run localStorage fixture: stage3 unlocked, all best/challengeBest null, sound off. This solely bypassed playing stages1/2 to access stage3; it is not evidence of normal unlock/persistence completion. No active game-state/clock/camera writes; no mid-play screenshot. Read-only RAF state sampling and GL draw wrappers ran equally in both. Independent contexts executed sequentially in one Chromium151.0.7922.173 process, ANGLE/SwiftShader software rendering; this is neither physical-phone performance nor a public HTTPS play verification.

| Source | Terminal | x / z | Jumps | Sample frames | FPS | p95 ms | Max read→input ms |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Published | dead | 13.300 / −1.458 | 0 | 52 | 27.64 | 83.40 | 330 |
| Saved PR22 | dead | 13.475 / −1.458 | 0 | 58 | 29.08 | 83.30 | 261 |

Both end grounded at y0, before the first gap. The first collider is x14,z0,w2.6,d1: the actual terminal state meets the original horizontal collision inequalities (distance x<0.7 and lateral<1.5). This is an obstacle collision, **not a failed gap jump/fall**, and does not reproduce the previously reported late-stage failures. Input traces show lateral overshoot/correction and long read/delivery delays. That supports investigating input timing under renderer load; it does not prove a harness defect, a game defect, or that simplifying the shutter would fix either. Candidate slightly higher FPS in this tiny failed segment is not a speed improvement claim.

FPS/p95 are derived from read-only play RAF timestamps, excluding first10 intervals; fewer than60 frames survived. These are short diagnostic samples, **not the normal200-frame performance test**. Zero page errors in both. Original save/bests remain unchanged because no clear occurred. No audio, fallback, other stages or browsers were tested in this limited task.

[Result/state/metrics](native-stage3-comparison.json) · [Published input timing](published-input-timing.json) · [Candidate input timing](saved-pr22-input-timing.json) · [Published frame states](published-states.json) · [Candidate frame states](saved-pr22-states.json) · [Published terminal screenshot](published-stage3-terminal.png) · [Candidate terminal screenshot](saved-pr22-stage3-terminal.png)

Reproduction uses `node --import tsx docs/release/orbit-shutter/limited-20261008/probe.mjs` (draw only) and `native-stage3.mjs` (one attempt per build). It expects the two respective built-source previews on4411/4412. It does not rerun itself or retry until clear. The attempt script faithfully retains the existing harness and catches its failed-clear assertion only to preserve both single outcomes.

## Next smallest step

First obtain a stable hardware-backed rendering environment and instrument native touch delivery/acceptance on the **published** first-obstacle section (one bounded attempt), with no difficulty or harness-policy change. Check whether observed 330ms delay and lateral overshoot persist before attributing failures to PR22 geometry. If a stable baseline meets the existing frame budget and the candidate then breaches it, independently trim only hidden backs/details from the saved Blender source, verify front/near/game silhouette, and label that new version explicitly; do not claim recovery of the unavailable old optimization. Current evidence does not authorize claiming stage3 completion, performance approval or publication.
