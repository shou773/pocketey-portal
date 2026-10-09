# Six-game polish: finite, verifiable milestones

Starting source: `975d3acfb03b02ddd2d5ae1f79edca228e0b9f90` (all six candidate games plus Tilt effects v3).
Work is candidate-only. Do not merge main, replace production, acquire assets, or add services as part of these milestones.

## First increment: Conveyor onboarding campaign

Three authored 4×3 boards use the existing toy-factory art:
1. **First dispatch:** one straight and one corner, each one tap from alignment. Two useful actions teach the inlet/outlet rule in the board itself. Minimum **2 turns**.
2. **Around the factory:** the original eight-tile route, initial orientations and endpoint are unchanged. Minimum **7 turns**.
3. **Read the inlet:** a downward-facing source, north-facing shipping opening and one unused belt. Seven belts deliver; the eighth need not rotate. Minimum **6 turns**.

This is a compact directed-alignment campaign, not a branching route-planning game. More turns alone would not create deeper decisions. A clockwise target is computed from the authored state; each target is also independently proved by enumerating every orientation configuration in unit tests.

Acceptance:
- Ordinary touch input clears all three and earns the exact minimum-turn stars; Next/unlocks, replay/reset and reload work.
- Every stage keeps independent layout, turn count and best. The old `pocketey-conveyor-v1` key is read only and preserved. Stable mission IDs live in the new versioned campaign key. No unearned first-stage clear is granted to legacy players.
- Fixed station mouths and their labels face their actual source/exit ports. All eight targets remain separated and at least 44px at 320px. JA/EN text remains readable in portrait/landscape.
- Pause, sound dialog, blur, canceled runs, stage changes, context loss, corrupt/blocked storage, future-version preservation and reduced motion remain safe.
- Existing 90-draw / 15,000-triangle limits are unchanged. Only two small single-sided interior planes distinguish real openings from painted rear walls; away-facing hoods are shallower so delivered parcels stay visible. No idle redraw or extra game loop is introduced.
- Exact-head type/build/unit/browser checks, actual before/after production renders and a source-marked dist artifact are required before preview review. Real-device GPU performance remains a separate observation.

## Next priorities, in order of evidence and player value

1. **Conveyor meaningful decisions:** prototype one optional branch or junction on a single board. Accept only if there are at least two legal player choices with understandable consequences, a no-guesswork visual language, solver coverage and one genuinely interesting minimum-move objective. Do not scale to ten alignment-only boards first.
2. **TiltTrail authored course rhythm:** keep the current visual identity and brake/speed skill. Add at most two compact course variants with different bend/brake rhythms, reachable goals and separate records. Preserve v1 progress. Keep the existing desktop ≥45 FPS / p95 ≤40 ms gate visible; performance remains failed in baseline SwiftShader. Do not expand effects or claim a hardware bottleneck without a profile.
3. **Orbit Ribbon meaningful mastery:** the automatic fixed forward speed makes clear time essentially length/speed. Prefer one optional risky collectible line or clean-run objective with visible tradeoffs, separate achievements and no corruption of old times. Prove both routes with ordinary input.
4. **Amber Step readable failure and rhythm:** identify the actual failure cause, show one short actionable retry hint, then author a teach/combine/test jump sequence. Accept by ordinary-input clear, readable landing/hazard shots, mobile simultaneous input and no reduced-motion regression.
5. **Pulse Drift a wave climax:** author a compact wave identity and clear danger telegraph before expanding stage count. Accept when telegraph timing, dodge routes, damage feedback and the climax can be distinguished in play, with save/retry/lifecycle checks.
6. **Alpine Drive a small driving campaign:** move from its single 12.5-second/four-turn prototype to three compact authored courses and a meaningful turn-accuracy objective. Accept distinct handling rhythm, normal-touch clears, understandable missed-turn feedback, separate bests and preserved prototype records.

Across every increment: choose visible or playable gains before decorative micro-detail. Keep at most two independent game changes under one integration owner. Retain original/cleared assets only. Do not add analytics, ads, accounts or backends. Ten-stage progression is a later content goal, not a promise that ten quick variants are polished games.

## Reference principles, not assets to copy

Official references considered for short-session learning, authored progression, readable 3D action and replay goals:
- [Super Mario Run](https://supermariorun.com/en/)
- [Super Monkey Ball Banana Rumble](https://asia.sega.com/bananarumble/en/)
- [Railbound](https://afterburn.itch.io/railbound)
- [Sky Force / Infinite Dreams](https://www.idreams.pl/)
- [Horizon Chase 2](https://horizonchase2.com/)
- [Subway Surfers](https://subwaysurfers.com/)

These inform quality questions, not a claim that this project matches their production scope. Do not copy their artwork, courses, branding or code.

## Optional Orbit collection increment

The three original courses keep their speed, platforms, hazards, jumps and clear conditions. Each gains three optional gold signals on outer lines. A direct safe route can finish with zero; a wider precision route can collect all three. This is a small replay objective, not an economy or a claim of deep branching progression.

Acceptance:
- Both 0/3 and 3/3 completed routes are independently feasible on every original course; ordinary keyboard/touch tests must prove them without state writes.
- Collection bests are awarded only when the run clears, never on a failed/interrupted run. Retry starts empty; lower scores cannot overwrite a better completed score.
- Stable course IDs use a separate versioned key. Existing stage unlocks, current/legacy clear times and Amber records retain their semantics. Unknown future signal versions stay read-only, including the explicit two-game reset.
- The optional objective is readable in JA/EN and accessible from the stage cards, play HUD and result. Timer text is secondary. A single batched original mesh adds at most one draw and24 triangles; no new animation loop, shader effect or asset download.
- Amber has no live signal mesh/HUD and never accesses signal storage during normal play; the existing explicit reset of both games includes signal records and says so.
- The accepted Conveyor and Tilt production sources stay frozen. Before/after rendered scenes, shared-Amber regressions, unchanged performance thresholds and a source-marked reusable dist accompany review.

## Alpine campaign milestone (candidate after0740cb3)
- Preserve the original50m/four-turn geometry,5m input window,45° execution, obstacle footprint and speed. Add a six-turn short/long/short return and an eight-turn steady1.375s cadence on the same50m extent. Eight turns is conditional on actual390px legibility, not a content-count target.
- Optional timing precision uses a1.2–2.8m pre-line band (400ms at4m/s). Latch the first accepted input per turn, retain it across pause/settings; allow steering corrections but never select a better repeated-tap timestamp. Award once only for a correctly executed turn. Save normalized precision only on a completed run, with no failed-run farming.
- Stable IDs and separatev2 key; legacy prototype clears/mute are a read-only backup. Old completion unlocks course2, not3; no invented historic precision. Reread before every write to protect later future formats and conservatively retain better records from another tab.
- Acceptance: all three ordinary touch/keyboard routes at0%/100%, progressive unlock/Next,320×568 and844×390 JA/EN controls, failure/retry/pause/settings/context loss, all-course footprint/scenery/cue projection and <20k whole-scene triangles. Exact-head types/build/unit and native evidence required.
- Capture before/after original course under fixed viewport/pointer/framebuffer/sound conditions and report all frame intervals. Historical Alpine native test was functional, explicitly not an FPS gate; timing diagnostics must not be presented as a previously enforced performance pass.
- Existing art/terrain, music and input binding are reused. Course selection rebuilds/disposes only the changed scene; retry retains it. No additional decorative meshes or physics changes.

## Reviewed preview ledger
- Conveyor 3-board campaign:29424ba, exact2/7/6 targets and saved layouts.
- Tilt 5-course progression:190772d; original3 preserved. Known software45FPS exceptions remain.
- Orbit optional 3-signal goals:0740cb3; clear-only records, original geometry/physics unchanged. Known desktop performance failures remain.
- Alpine 3-course timing challenge:a3c3fc6; 119 units and 12 ordinary 0%/100% keyboard/touch routes. Same-course software timing remains poor (two matched pairs: mobile28.54→26.64 and27.48→25.65; desktop22.67→21.24 and21.88→21.39FPS). Same original geometry 47 draws / 8274 visible triangles; course 3 max 67 / 10062. This is functional/visual preview acceptance, not a performance pass or physical-phone latency claim.

## Amber guidance increment
Preserve all three existing stage objects, collisions, movement, jump buffering, camera, art, save semantics and Orbit signals. Describe only observed spike/fall causes, with an edge-spike instruction for the actual three spike+gap combinations. Unknown terminal causes get neutral help. A dismissible first-spike lesson teaches stopping to line up and simultaneous movement+jump; it survives waiting, disappears only after a grounded crossing or dismissal, and is hidden on pause/results/recovery. No new storage, timing meter, collectible or animation.
Acceptance: all 19 actual spike contact is classified correctly, the three edge-spike cases use their adjacent gap, falls do not receive an invented early/late diagnosis, first-use waiting and grounded crossing are tested, JA/EN cue and 44px dismiss control remain readable without covering controls, and shared Orbit collection/reset/lifecycle regressions remain covered. Use exact-head build/native evidence and retain existing 45 FPS / 40 ms gates without silently skipping shared-module checks.

## Pulse sweep/reset increment
- Keep all three original durations, spawn times/counts/kinds, drift speeds, bullets, beam lanes/warnings, hitboxes, four shields, damage grace, scores and v1 saves. Only the initial x positions of the final three existing enemy slots change to -2.6 / 0 / +2.6. A normalized-source hash proves that all other model code is unchanged.
- The final spawn n values are [13,14,15], [17,18,19], [13,14,15]. Stage 1's last time is just below28.8 because of floating accumulation; using a rounded time would incorrectly select n16. Actual fixed-step schedule tests cover this boundary.
- State the real objectives: survive36/42 seconds, or defeat the boss before48 seconds. Add a non-animated28.5–30 second arrival notice without replacing the existing beam warning. Keep pause/retry/result/context-loss and JA/EN behavior consistent; compact menus must remain scrollable.
- Acceptance: original model tests plus exact schedule/kind/count audit; independent original4HP feasibility; all three native keyboard/touch clears with29–32 second fan/beam/boss observations; save/reload, compact320×568/844×390, actual390px arrival/boss views and reduced-motion evidence. Reachability is not a claim that every route is damage-free or novice-friendly.
- Reuse the renderer and all assets byte-for-byte. Report original/candidate full-run software timing with matching viewport/pointer/framebuffer conditions; captures may affect those diagnostic intervals. Do not claim a speedup or a physical-phone result. Other five production sources stay frozen.
- Amber4a40219 is accepted for preview:125 units,6 new native checks and6 original keyboard/touch clears. Its old desktop45FPS/40ms gate remains failed at43.18FPS/p95 50ms. The shared renderer/physics/stage data are unchanged.

### Pulse lane readability correction
The first999deaa native milestone passed130 units, all six ordinary-input clears, eight retained UI cases and matched60FPS touch diagnostics. Actual handoff pixels nevertheless showed a faint olive beam strip against teal water; the old fogged amber material pulsed down to0.15 opacity. Before preview acceptance, change only that material to unfogged amber with a steady0.55 warning opacity; retain active0.85, geometry, width,1.3-second telegraph and collision. A normalized-renderer hash guards this scope. Recheck both native boss routes, lifecycle/compact/reduced motion, and unpaused normal/minimum-warning/handoff captures against exact999deaa. Original four survival-route proofs remain linked to that production-equivalent model/app source rather than rerunning unchanged routes.


## Conveyor first route-choice delivery
Append one six-tile4×3 board, `choose-a-route`, after the three preserved boards. A two-way elbow accepts either open port, with blue rails and two outward white arrowheads; the green directed belts retain their original single inlet/outlet. The upper and lower paths both deliver through four tiles. Exhaustive4096-state enumeration finds16 configurations per path: minimum5 turns above,3 below. Both successes are rewarded; the3-turn star is optional and unused belts may stay untouched. This is the first branching lesson, not a claim of deep route optimization.

Acceptance:
- Every complete old-board trace/visit remains identical; original mission objects and solver outputs are preserved. The branching solver explores orientations accepting the real incoming port. Motion keeps its existing real-entry/exit path construction.
- Both paths clear through ordinary taps, with actual mid-delivery and success images. At320×568 and844×390 the two-way heads/rails and both routes are readable, with separate44px targets. JA/EN rules and accessible names distinguish bidirectional openings from a directed inlet. Existing station art, music/effects and lifecycle stay intact.
- Separate `pocketey-conveyor-campaign-v3` imports all validv2 layouts/turns/bests/active IDs; oldv2/v1 remain read-only. No fourth clear is invented. Mission4 unlocks only after mission3. Valid backup fields survive damagedv3 records; rereading before every write protects newer versions and another tab's better records/layouts.
- Old three renders must retain their geometry budgets; the fourth must stay within90 draws/15,000 triangles. Only the new tile's paint/arrows change; no scenery/particles. Exact-head types/build/unit/native checks and reusable dist accompany the review.

Pulse a6ad589 is accepted after the material-only warning correction:131 units, both native boss routes and eight retained UI cases pass. Both boss clears retain4HP. Same-condition390px reduced-motion diagnostics are59.80→60.00FPS, p95 16.7ms, identical15 draws/6168 triangles; they do not imply a physical-phone result. The earlier999deaa evidence retains all six ordinary routes. Other software-performance limitations remain on the preview ledger.
