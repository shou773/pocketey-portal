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
