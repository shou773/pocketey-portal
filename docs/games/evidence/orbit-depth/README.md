# Orbit Ribbon: moonlit raceway visual review

Base: public main `a443ec37c33cae22021c82b7b20f3fb6e62f02c6`. Branch: `art/orbit-ribbon-depth`.
This is the early visual candidate, awaiting visual approval before full CI. No merge or publication is requested here.

## Direction and scope

The parent research reviewed the official [WipEout Omega Collection page](https://www.playstation.com/ja-jp/games/wipeout-omega-collection/) and its [official screenshot](https://gmedia.playstation.com/is/image/SIEPDC/wipeout-omege-collection-screen-04-ps4-08jun17?wid=1280): low vehicles with separate canopy/armor/engines, bright road tops with dark sides, large architecture with breathing room. This agent successfully read the official page; the visual observations are attributed to the parent's research. No reference artwork, logo, ship or course is copied or shipped.

Our independent direction is a moonlit orbital raceway. Preserve the existing Kenney speeder and decks; paint the canopy dark blue, armor pale alloy and engines cyan. Bright deck panels contrast with the dark structural base. Replace abstract pink cubes with coral safety equipment, warm framing and inset warning panels. Three large relay stations outside the flight lane replace numerous small decorative stations. A larger, softly lit procedural planet establishes scale; its position is below the time display. Stars, existing two lights, camera and resolution budgets are preserved. No postprocessing, shadows, transparency effects or dependencies are added.

`src/games/orbit-art.ts` contains only Orbit presentation. The shared renderer edits are guarded by `kind === 'orbit'`; Amber retains its existing geometry, colors and input. Physics, collision, layouts, difficulty, sound, save and UI source files remain unchanged. The new GLB is optional: its load failure uses the procedural relay fallback.

## Blender deliverable

`public/games/assets/orbit/lunar-relay.glb` is an original Pocketey relay, generated with Blender 4.3.2 using [relay.blender.py](relay.blender.py). It has a chamfered observation tower, docking apron, hangar, receiver and inset window bands. No imported models or textures are used. Export: **58,032 bytes, 732 triangles, three opaque meshes/materials**, no animations, lights, cameras or textures. Runtime converts the three materials to lightweight Lambert paint and merges the scenery into the existing static batch. The existing player model remains unchanged on disk.

Reproduce from the repository root:

```sh
blender -b -t 1 --python docs/games/evidence/orbit-depth/relay.blender.py
```

## Same-condition images and continuous play

| Scene | Before | After |
| --- | --- | --- |
| Phone start, 390×844 | [before](before/390-start.png) | [after](after/390-start.png) |
| Phone hazard/gap approach | [before](before/390-gap.png) | [after](after/390-gap.png) |
| Desktop start, 1280×720 | [before](before/1280-start.png) | [after](after/1280-start.png) |
| Desktop hazard/gap approach | [before](before/1280-gap.png) | [after](after/1280-gap.png) |

[capture.mts](capture.mts) opens the actual game route, waits for art adoption, selects stage 3 through a preserved legacy unlocked-save fixture, and invokes the normal start action. Normal keyboard steering/jump inputs advance the original simulation through held rAF callbacks at 60Hz. The simulation is never written or replaced. Mobile/desktop start both have x=0; gap approach both have x=20.767, y=0, z=1.750. Capture JSON and complete input traces are retained. Only Astro's development toolbar is hidden for screenshots; the product UI is unchanged.

Six frames from the same phone play at approximately x=24.2, 25.2, 26.2, 27.5, 29.2 and 31.2 show approach, takeoff, airborne crossing and landing: [1](after/390-motion-1.png), [2](after/390-motion-2.png), [3](after/390-motion-3.png), [4](after/390-motion-4.png), [5](after/390-motion-5.png), [6](after/390-motion-6.png). Matching before frames are retained. All screenshots have running state and no script errors. Actual continuous frames were visually inspected; no video playback or physical-phone evaluation is claimed. No transient effects were introduced.

Initial image review found a planet/HUD overlap and coplanar warning-frame flicker; both were fixed before the final captures. The flight lane, next landing surface and warm hazard frames remain legible during the jump. One inherited close-pass behavior remains: a nearby obstacle can temporarily obscure the ship while it steers past it; the matching before sequence does the same. This is an observation for later camera/fairness evaluation, not a difficulty or collision change. Automated normal-input success does not establish human difficulty balance.

The parent additionally requested delayed steering/jump observations. [Late steering approach](observe/390-late-steer-approach.png) delays avoidance until within 1 m of the first center hazard, then ordinary left input fails at x=13.300, z=-0.167. Both open side lanes and the warm obstacle outline were visible before collision; at 7 m/s this deliberately late decision leaves about 0.14 seconds to clear the center. [Late jump approach](observe/390-late-jump-approach.png) and [airborne crossing](observe/390-late-jump-airborne.png) use a jump input only at x≈26.35, approximately 0.35 m beyond the first edge. The existing forgiving jump window accepts it and the player lands successfully. Neither observation changes simulation or proves human reaction-time fairness. [Observation states/traces](observe/capture.json) distinguish the failed steering from the recovered jump. The near-left obstacle partly obscures the ship at the jump approach, an inherited visibility issue noted above. Speed remains 7 m/s; later balance work should isolate side-switch/gap combinations and recovery intervals rather than add more pillars.

Reproduce with candidate Astro dev on 4322 and a clean base worktree on 4323, sharing installed dependencies:

```sh
ORBIT_BASE_URL=http://127.0.0.1:4323 npx tsx docs/games/evidence/orbit-depth/capture.mts before
npx tsx docs/games/evidence/orbit-depth/capture.mts after
node docs/games/evidence/orbit-depth/performance.mjs
```

## Early checks and limits

Game TypeScript and the existing `orbit: selected 3D art loads, animation and normal controls remain usable` browser test pass ([types.log](types.log), [targeted.log](targeted.log)). This verifies art adoption, ordinary steering/jump and pause without changing the tests. Full normal-input all-stage, fallback, saves, cross-browser and release CI remain pending visual approval.

Draw submissions drop from **11 to 9**. Submitted triangles increase from **4,960 to 7,724** at stage-1 start and **5,696 to 8,700** at stage-3 approach. These include offscreen static scenery; they are not visible-pixel counts. [performance.json](performance.json) retains three alternating rounds per viewport, DPR1 Chromium SwiftShader, with 30 warmup and 119 measured frames per isolated stage-3 start renderer. The state stays fixed for this short diagnostic; it is not the normal-input stage-3 release gate or physical-device proof. The earlier [performance-overlap.json](performance-overlap.json) had a targeted browser test running concurrently during part of the probe and is retained as confounded, not used to judge regression. The final probe ran without other browser tasks. No thresholds were relaxed.

All twelve final diagnostic samples are approximately **60.00 fps**, with **p95 16.7–16.8 ms** for both base and candidate at phone and desktop sizes. Mean synchronous submission varies between 0.185 and 0.287 ms across all samples; this is CPU/driver submission time, not asynchronous GPU duration. No slowdown was observed in this limited fixed-state probe. Full-stage and physical-device performance remain unverified.

The GitHub CLI token was invalid; authenticated GitHub connector operations are used for the draft branch/PR. No credentials or auth workaround is introduced. The current quality workflow triggers only selected push branches and workflow dispatch, so this dedicated branch does not start long CI automatically. The parent can dispatch it after accepting the visual direction. Main and publication are untouched.

Automatic approval review rejected one baseline input-trace blob because it included an Astro development field with a local source path. The baseline is a clean worktree of the exact requested public commit of this same repository. Unnecessary `astro*` development metadata was removed from all logs and the capture script; generated gameplay states, native inputs and screenshots are retained. No private-source content or development paths are included in the resulting evidence.
