# Pocket Cargo / ポケット荷造り

A small, dependency-free browser packing puzzle. Pick one of two parcels, rotate it, and fit it into a 4×4 truck. Five parcels or a full truck end a trip; three trips make a run.

## Run and verify

Requires Node.js 22 or newer. No package installation is needed.

```text
npm test
npm run dev
```

Open the Local URL printed by the server. It binds only to 127.0.0.1. Deploy `dist/` as static files for sharing; ES modules must be served over HTTP(S).

## Action Lab: four playable prototypes

Open `/lab/index.html` to compare four short, single-player action experiments. Each has a 75-second boss encounter, keyboard and on-screen movement, a dedicated action, two immediately selectable body/weapon forms, optional generated sound, pause/resume, and a retry loop.

- `#reflect`: time a guard to return enemy projectiles. The wide form is forgiving; the horn form has a shorter window and stronger returns. Early reflection gives a timing bonus.
- `#yoyo`: throw, reposition, and recall a tethered weapon. The return trip deals more damage. Compare a slow heavy ball with a fast wall-bouncing ring.
- `#scrap`: mount cannons, shields, or spikes on the left, right, and rear. Movement changes body heading; cannons fire along their mounted direction. Dash through the boss to land a rear-spike hit. Parts can be changed in the setup and during combat.
- `#grow`: eat nearby food or bite a nearby boss with the action button. Growth increases damage while changing size and speed. Compare a large round body with a slimmer tailed body. The Q key / slimming button removes two growth units to regain clearance through narrow gates.

Controls: WASD or arrows to move, Space for the selected action, Q to slim in Grow, and Escape or the pause button to pause. On touch devices, drag the movement pad and tap the action button. Mouse aiming is optional for the yoyo; pad play aims at the boss automatically.

Each completed encounter awards six materials for a win or two for defeat/time-out. Three materials buy one persistent basic upgrade (+1 life, +8% damage per level), capped at three levels. Runs begin with seven life plus basic upgrades. The two forms are free to compare from the start. Materials are isolated per prototype. Body growth in Grow resets each encounter. These are test rules, not a balanced economy or a monetization design.

Run progress, optional ratings and short notes stay in localStorage under `pocketey-action-lab-v1`. Feedback is not transmitted automatically; the copy button copies all four summaries only when requested. Interrupted combat is not restored after reload. Switching prototypes abandons the current encounter without awarding materials. No accounts, ads, paid assets, payments, external fonts or game servers were added to the game bundle.

`dist/lab/sim.mjs` contains deterministic rules, `paint.mjs` draws original canvas artwork, and `app.mjs` owns browser controls and persistence. `tests/lab.test.mjs` verifies reflection windows, return-path damage, part placement and shielding, growth/clearance tradeoffs, projectile collision, end rewards, upgrade caps, corrupted saves, and complete simulated encounters across all eight mode/form combinations. Passing tests do not establish fun, retention, commercial demand or revenue.

## Rules

- Each turn offers two shapes; placing one discards the other.
- Rotations preserve a normalized top-left anchor. Parcels cannot overlap.
- A truck leaves after five placed parcels or when all 16 spaces are full. Players may depart earlier, including when neither candidate fits.
- Each occupied space scores 10 points; each complete row or column scores 5 additional points; a full truck scores another 40. The maximum is 240 per trip / 720 per run.
- One undo is available per truck, before departure.
- Daily cargo uses a shared UTC date seed; random runs get fresh seeds. Retrying a run preserves its cargo sequence.
- Random cargo is not guaranteed to admit a perfect full truck.

## Implemented

Japanese/English interface, mouse/tap controls, rotation with R, candidate selection with 1/2, board keyboard navigation, local best score and progress, daily seed, optional synthesized sound, reduced-motion support, and pure deterministic rules with Node tests.

## Data and assets

The game bundle makes no network requests beyond its own static files and has no ads, tracking SDKs, AI calls, accounts, or payments. Progress, settings and small play counters stay in localStorage on the current origin. Hosting providers may separately handle access logs and authentication. All graphics are original CSS/SVG; no downloaded assets or external fonts are required.

Local-save validation detects malformed states. It is not a security boundary or an anti-cheat system, and scores must not be trusted for a public leaderboard.

## Scope

This is a playtest prototype, not an advertisement-ready commercial launch. Ads, third-party reporting, purchases, accounts and any public leaderboard require separate integration, privacy updates and platform checks. Gameplay tests do not establish demand or expected revenue.

`dist/engine.mjs` owns rules; `dist/app.mjs` owns browser UI and persistence. `tests/engine.test.mjs` covers deterministic generation, rotations, legal/illegal placement, immutable transitions, scoring, complete runs, undo and save integrity.
