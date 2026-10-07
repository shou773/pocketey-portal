# Three-stage difficulty prototype

This candidate extends the reviewed `df9bc0e` art refresh. It is not published yet. The three stages per game prototype introduction, middle-course combinations and advanced sequences for a future ten-stage progression; ten stages are not added here. Exact-head CI and independent parent review are required before publication.

## Layouts and intended challenge

Movement remains Orbit 7m/s, Amber 5m/s, jump velocity8.8/gravity22, fixed120Hz simulation, existing collision padding, coyote time and jump buffer. Platform width is unchanged. Difficulty comes from visible sequences and landing/takeoff choices, rather than input delay or smaller player collision boxes.

| Game/stage | Length | Gaps | Widest gap | Obstacles | Intended decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Orbit1, introduction | 104 | 3 | 3.2 | 7 | Learn side avoidance, then jump; opening pillar is at16m |
| Orbit2, middle | 125 | 4 | 3.9 | 8 | Alternate broad side pillars and prepare a jump after avoidance |
| Orbit3, advanced | 150 | 5 | 4.3 | 11 | Repeated left/right switches, followed by longer jumps |
| Amber1, introduction | 52 | 4 | 2.6 | 5 | Separate spike and gap jumps; a small0.45m rise; stopping is allowed |
| Amber2, middle | 62 | 5 | 2.4 | 6 | Spikes on successive raised/lowered platforms; rises up to0.6m |
| Amber3, advanced | 85 | 7 | 2.6 | 8 | Combine edge spikes with downhill gaps, then adjust for uphill landings |

Orbit's side obstacles leave broad opposite-side corridors. Amber's edge-spike combinations lead to lower platforms, providing more flight time; uphill gaps are separate takeoff decisions. Colored gap edges and red obstacles remain visible ahead of the player. Stage3 can be restarted directly by users who already unlocked it; no checkpoint feature is added to these short prototypes.

The simulator verifies each gap with multiple0.1m takeoff samples, including edge-spike combinations, and verifies complete routes with ordinary axis/jump inputs. Browser tests use real keyboard events and CDP two-finger touch from stage start, without physics-state writes. These checks establish feasibility and regressions, not that humans will find the difficulty appropriate. Post-release player feedback is needed for the next tuning pass.

## Existing progress and records

The save key and version stay `pocketey-orbit-amber-v1`, version1. Existing unlocks, sound and the original `best` arrays remain intact. Revised-course results are stored in a separate `challengeBest` array. Menus explicitly identify any selected stage's old-course BEST as kept separately, while stage cards/results use the new-course BEST. The old and new layouts differ in length and hazards, so their times are not compared. Reset continues to clear only these two games' records and sound, leaving other storage and language preferences alone.

Unit tests verify old-save roundtrip and separate records. A native browser test clears the revised Orbit1 with a legacy13s record and verifies that the old13/16/18s values survive while the longer new-course time is recorded separately. Reopen/cross-game persistence tests check the new records.

## Rendering budget and diagnostic history

The reviewed models, palette, animation, lighting and backdrop are retained. The art-only `df9bc0e` exact CI37664415393 passed all four public-baseline controls (desktop46.16/46.72fps) but the candidate desktop gates failed44.19/43.51fps; both p95 were33.4ms. Touch was about60fps. This residual software-GPU difference motivated one bounded production change, rather than restarting shader experiments.

Canvases at least1000 CSS pixels wide now use350,000 internal pixels rather than450,000. Narrower canvases retain450,000, including the phone portrait/landscape tests. DPR ceiling remains1.6. DOM text, HUD and controls retain native resolution; cameras, physics and collision dimensions are unchanged. The wide-canvas buffer has about12% fewer pixels along each dimension. The rule is identical in production and tests, with no CI/browser detection or adaptive mechanism. The fps/p95 release thresholds remain >=45fps and <=40ms.

[Same-layout, same-camera450k/350k images](evidence/difficulty-refresh/) and the paired alternating comparison isolate this budget change. All24 alternating samples are retained: desktop Orbit450k38.46–54.54fps versus350k49.87–58.42; Amber450k50.30–55.59 versus350k54.00–56.96. Mobile stays about60fps for both budgets. One Orbit pair reverses direction, so these short noisy samples do not establish a uniform speedup and are not a substitute for full stage3 gameplay gates. Software-GPU numbers and emulated touch are not physical iPhone guarantees.

## Verification and handoff

Local candidate:20/20 Chromium passed, including all six revised stages with keyboard and two-finger touch, legacy/new records, reopen, background pause, rotation,320px width, safe areas, WebGL loss and model/texture failure fallback. Stage3 desktop: Orbit52.78fps/p9533.4ms; Amber47.30fps/p9533.4ms. Touch: Orbit60.00/16.7, Amber59.38/16.8. [Raw local report and environment](evidence/difficulty-refresh/final-local/). Astro check, game typecheck, production build and nine model tests pass, including independent takeoff-window sampling. Legacy unlocked-stage3 menus also start successfully at320×568 in Japanese/English for both games, with old-course BEST notes visible after ordinary overlay scrolling. Exact final CI is tracked in PR6. [Payload inventory](evidence/difficulty-refresh/payload.json): selected game downloads stay Orbit46,444bytes/Amber302,108bytes; public-main-to-candidate whole-build increase518,177bytes, theoretical gzip162,771bytes. JS increase127,966bytes/gzip35,735bytes. These are build/theoretical compression sizes, not a measured first-load CDN transfer.

[New normal-play danger/airborne views](evidence/difficulty-refresh/) use an independent run from x=0 per image, with a legacy unlocked-3 save fixture only to select stage3. The overlay is hidden normally. rAF is held for the final screenshot without physics-state writes. An initial multi-image run failed after screenshot-time pause/resume delayed the next jump; that capture-harness failure is retained and the final images do not resume after a freeze.

CI's public-baseline control now runs the public baseline's own frozen test/model/input files from its extracted checkout. It cannot use the revised stage layouts or new record assertions against the old game. Baseline failures are retained as diagnostics; the candidate20-case gate remains mandatory. Portal and Firefox/WebKit run the revised layouts and records.

After exact-head CI and parent approval, merge only this PR through the existing GitHub Actions→GitHub Pages route. Verify pocketey.com and www routes, deployed JS/model/texture hashes, bilingual instructions/record note, normal movement/jumps and preserved saves. No other game branches, accounts, paid assets or contracts are included.

## Exact-CI input follow-up

Candidate `a361011` CI37669891692 passed portal12 and Firefox/WebKit10, and desktop stage3 performance reached Orbit58.17fps/p9516.8ms and Amber55.88/p9533.3. Chromium was18/20: Amber touch stage3 died atx62.792/y1.332 near spike63.4; the Amber context-loss test died atx3.375/y0.471 near spike4 during its preparatory stage1 clear, before context loss. [The failed browser log is retained](evidence/difficulty-refresh/ci-a361011-browser.log). Neither failure establishes a recovery-code fault or impossible geometry.

The ordinary native input driver now asks for isolated spike jumps2.0m ahead (previously1.65) and edge-spike/gap jumps1.7m ahead (previously1.35). The latter starts near the early safe takeoff edge; sampled stage3 combo windows are17.6–18.4,38.7–39.4 and61.7–62.4m. Read/poll/CDP delivery consumes part of those windows. Requests are still keyboard or two-finger CDP touch, never physics-state writes. The game layout, collisions, movement and rendering are unchanged in this follow-up. Input traces are written even when route completion fails.

[Three independent local touch runs plus three context-loss cases](evidence/difficulty-refresh/input-follow-up/) passed6/6. Native jump requests atx61.75 reached the safe combo window before spike63.4; read-to-input acknowledgments for those commands were about30–40ms. Full traces and latency summary are retained; these wall-time intervals include reads/transport and do not claim exact simulation-delivery latency.
