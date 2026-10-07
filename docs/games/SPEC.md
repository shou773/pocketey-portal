# Pocketey short action games

Two original, mobile-first WebGL games, each with three authored stages. No copied art, names, layouts, or game code. No accounts, monetization, tracking, or network game state.

- **Orbit Ribbon** `/games/orbit-ribbon/`: automatic forward run, fixed rear camera, lateral steering and jump. Stage 1 teaches gaps; stage 2 adds lane-blocking pillars; stage 3 combines both. No gravity rotation.
- **Amber Step** `/games/amber-step/`: side-view 2.5D platforming on a fixed plane, move left/right and jump. Stage 1 teaches gaps, stage 2 raised platforms, stage 3 combines elevation and spikes.

Shared: Japanese instructions, touch move/jump with multiple simultaneous fingers, arrows/A/D and Space, pause/Escape, instant retry/R, stage unlocking, next/replay, local best times, sound opt-in, scoped reset confirmation. Fixed 120 Hz simulation with capped elapsed time, jump buffering and coyote time. Only one render loop and input lifecycle per page.

Visual direction: midnight indigo/cyan orbital bridges, warm amber/purple floating garden. Original geometric courier, lit solid geometry, clear landing surfaces, no camera rotation. Responsive portrait and landscape; safe-area touch zones.

Isolation: based on main 63f48b6, branch codex/orbit-and-amber. Prior prototypes remain untouched in codex/pocket-cargo-playtest / draft PR #2. Existing travel content remains intact. Only a small Games navigation link is added.

Deployment: investigate existing main-triggered workflow and Cloudflare integration before release. Do not alter DNS, access or credentials. Retain prior main SHA for rollback. Sites is not the target.
