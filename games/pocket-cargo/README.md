# Pocket Cargo / ポケット荷造り

A small, dependency-free browser packing puzzle. Pick one of two parcels, rotate it, and fit it into a 4×4 truck. Five parcels or a full truck end a trip; three trips make a run.

## Run and verify

Requires Node.js 22 or newer. No package installation is needed.

```text
npm test
npm run dev
```

Open the Local URL printed by the server. It binds only to 127.0.0.1. Deploy `dist/` as static files for sharing; ES modules must be served over HTTP(S).

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
