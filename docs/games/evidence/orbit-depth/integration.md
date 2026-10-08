# Main integration verification — 2026-10-08

Integrated main `1e071902bda809c4e0beaabffe7ebb81b99e4342` (Amber PR 13 and Tilt PR 15) into the approved Orbit candidate `9a066c798d0bdd076084f07772d64527b369100d`.

Three renderer conflicts were resolved: imports retain both game helpers; background decoration retains Orbit stations and Amber's deliberate removal of misleading nearby islands; asynchronous adoption loads each game's original Blender landmark only for that game. Amber canyon/platform/plant functions, landmark fallback, Oodi animation and its guarded render budget remain intact. Orbit planet, hazard frames, ship batching, relay fallback and camera remain intact. Orbit helper/material/image files are unchanged from the approved candidate.

Against main, the change is limited to Orbit renderer/helper, Orbit assets and Orbit evidence. Other game code, models, stages, physics, input, saves, audio, common UI, dependencies, CI and existing tests are unchanged from main except the explicitly approved Pulse UI synchronization fix described below.

Game TypeScript and final production build/route guard pass. Existing Chromium production tests pass **8/8**, with original assertions and timeouts: both games' all-three-stage keyboard/touch play and persistence, selected art/animation/normal controls, and failed Kenney GLB fallback/clear/save. Mobile art-jump images were visually inspected for both games.

| Stage-3 normal input | fps | p95 ms |
| --- | ---: | ---: |
| Orbit keyboard | 50.44 | 33.4 |
| Orbit CDP touch | 60.00 | 16.7 |
| Amber keyboard | 50.89 | 33.4 |
| Amber CDP touch | 60.00 | 16.7 |

Tests used an isolated production server on port 4350, reuse disabled. They ran the build containing the resolved Amber/Orbit renderer; Tilt was then integrated without shared-renderer changes and the final full production build passed. These are SwiftShader observations, not physical-device measurements. Raw local report: `/tmp/orbit-integration-report.json`; images and traces: `/tmp/orbit-integration-regression/`.

The previous exact-head Actions run 37753809529 applies to 9a066c7, not this integration tree. No new whole-CI run, PR merge or publication was performed here. Parent integration order and final exact-head verification remain pending.

## Approved Pulse test synchronization

The parent authorized a one-statement test-only correction in `tests/prototypes/ui.mjs`: after resume, wait up to 3 seconds for both `data-mode=play` and diagnostic `time > frozen`, retaining the original explicit time assertion. No Pulse implementation changes were made. The parent's limited diagnosis observed the visible clock progressing while diagnostic time updated after about 261ms; applying that explanation to the old CI failure remains an inference.

The unchanged remainder of the actual UI script passes all eight cases (four viewport sizes, corrupt/blocked storage, unavailable WebGL and context loss); see `integration-pulse-ui.json`. A separate probe extracts and executes the actual wait statement against a static DOM: mode=play with unchanged time fails after 3004ms; mode=pause with advanced time fails after 3002ms; mode=play with time advancing after 1200ms passes after 1216ms. See `integration-pulse-sync.json`. The probe does not mutate a game or relax any threshold.
