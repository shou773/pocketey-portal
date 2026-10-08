# New-game depth review

Base: published merge66d1f82ba2a442872fa596a5913abcf173612e69 (PR9). Separate visual candidate; not deployed pending independent parent review of the first comparison.

## Observed causes, limited to three per game

Pulse Drift: repeating equal-distance rectangular columns; featureless open grid with no physical deck; no low-contrast distant layer. Limit this first pass to the background: add a thick deck, modular middle-distance columns with footings/caps, and a fogged distant skyline. Existing player/enemy geometry, rotations and materials remain. White hitbox core, red bullets and amber warning stay distinct. Repeated architecture/grid rows are instanced (five architecture plus two grid draw calls). No shadows, postprocessing, external models, textures or new dependencies.

TiltTrail: road has no visible thickness; loose equally spaced rocks do not form a landscape; road/rocks share a material. Keep road top tessellation, widths and orange edges exactly unchanged. Add dark0.42-unit side walls/end faces below y=0, at one sample per unit, and gather the24 rock instances into six overlapping island clusters well outside/below the course. Separate muted stone and dark side materials from the lit teal road/orange drop edges/mint ball. Existing contact decal and directional light remain. No added piers or road obstacle. Physics, support width, knots, camera, framebuffer budget and difficulty remain.

## Same-camera comparison

`evidence/before-*` and `after-*` PNGs are exported from unchanged production createView functions, in identical390x844 touch and1280x900 fine-pointer browser contexts at DPR1. The isolated QA canvas has the actual mobile/desktop game dimensions. The matching JSON files include complete states, CSS sizes, framebuffers and draw counters.

Pulse is an ordinary model-step input trajectory at stage3,time9 (playing), including live enemies, red bullets and the beginning of the amber warning. Tilt is an ordinary steering/braking trajectory at stage3,time6 (playing). Both use the real unchanged model; no invulnerability, collision/time bypass, camera override, test resolution or altered material. These are deterministic production-render comparisons, not screenshots of native end-to-end input; native clear/save tests are separate. All four before/after states must match exactly.

## Published CI failure follow-up

Postmerge37723107157 new-games fails because Pulse keyboard3 losesHP0,time35.683,score1600. Audio41+56/Tilt6/PulseUI8/retry/performance pass. This is separate from the existing-game desktop FPS failures and is not called GPU noise. Public native follow-up without blocking active-play screenshots and with50ms observation clears all3 stages (HP3/1/1), save/reload identical; both timing variables changed, so that alone cannot assign a cause.

A separate public100ms/no-active-screenshot stage3 diagnostic still loses. Its saved input/position/threat trace shows the driver holding ArrowRight through firing beam corridors at16.2→16.4 and21.33→21.53, costing two shields; it later crosses a nearby bullet. The old driver scores only destination safety and can choose a safe target on the opposite side of an active hazard. This establishes a controller flaw in this diagnostic, not the precise original CI final hit. Normal controls respond and the intended win condition (boss killed before48s) is achievable without model changes.

A first corrected-controller run clears touch1/2/3 (HP4/4/4), keyboard2/3 (HP4/2), but keyboard1 reads stale menu diagnostics at time0 and exits before play. Preserve this failure; the driver now waits for actual play mode, correct stage and positive simulation time after native Launch instead of assuming200ms is enough.

The test-only correction scores travel through beam lanes and short-term bullet trajectories, polls50ms and removes blocking active-play screenshots; results are still captured. It adds no retry, enemy removal, immunity, save mutation or threshold reduction. Original failure logs remain under the PR9 CI and the outside-repo public66 verification archive. Direct listening/physical iPhone remain unverified from the published release.

Comparison counters (before→after): Pulse desktop/mobile48→16 calls,856→1468 triangles; Tilt desktop10→11 calls,5188→5680 triangles; Tilt mobile8→9 calls,4536→5028 triangles. At viewport1280x900 the actual Tilt canvas has590x345 pixels; mobile367x653. Pulse actual canvas pixels578x556 desktop/364x521 mobile. All before/after CSS sizes/framebuffers are identical; dimensions are measured from each real route before rendering the comparison. Instanced architecture is explicitly disposed on renderer/course teardown.

Reproduction harness: `scripts/capture-new-game-depth.mjs before|after` against an Astro dev server (default4332, override DEPTH_BASE_URL). Run once against published66 sources and once against the candidate; source renderer/model modules are loaded directly without art/test overrides. Native end-to-end input tests use the built public routes.

`native-before/after-*` full-page images separately show actual native Stage3 selection, Sound ON, Launch/Play, brief gameplay and Pause in both device layouts. Published66 is built unmodified in a detached worktree; candidate uses the production build. No gameplay state is written. Tilt holds the native brake to keep the short segment on the road. Camera code/viewport match, but simulation times can differ slightly across native captures; use the deterministic canvas pairs for exact position/camera comparison. All eight captures have zero page errors; `native-play.json` records states.

Static validation:24 model tests pass; Astro check0 errors/0 warnings (six existing hints); games TypeScript check and production build/portal retirement guard pass. Full candidate native keyboard/touch, audio and unchanged CI gates are in progress; this is a review candidate, not a claim of completed publication.

Final local validation: Pulse all6 native stages clear/save/reload, touchHP4/4/4 and keyboardHP3/3/2, errors[]. Tilt all6 native stages clear/save/reload/errors[], plus allfour UI/fallback/context-loss cases pass; desktop performance gate fails33.01fps/p9550ms while touch47.01fps/p9533.4ms passes. Overall Tilt suite5pass/1failed (performance only), retained. Chromium release/audio41/41 passes including actual play music/effects captures. Correcting comparison canvas dimensions adds no production changes; preliminary exact CI e3786c9 is retained, final evidence commit gets its own exact CI. No post-candidate gameplay/render changes or threshold reductions.
