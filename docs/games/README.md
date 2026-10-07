# Developing the two action games

Requires Node 22+ and npm. The root Astro build includes `/games/`, `/games/orbit-ribbon/`, and `/games/amber-step/`. There are no game servers, downloaded art, external fonts, or runtime CDN dependencies. Three.js is bundled from npm; its MIT license remains in node_modules/three/LICENSE.

```sh
npm ci
npm run check:games
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4322
npm run test:browser
```

Browser tests use `/usr/bin/chromium` locally; CI installs its matching Playwright Chromium. Set `ASTRO_TELEMETRY_DISABLED=1` in a cloud sandbox whose home configuration directory is not writable. Screenshots and JSON results go to `test-results/`, which is ignored by Git. The GitHub Games quality workflow uploads these as an artifact.

`npm run check` checks the whole legacy site as well. Its 48 existing errors in `src/pages/contact.astro` are documented in RELEASE.md; that source is unchanged from main. `npm run check:games` strictly checks the new TypeScript simulation, rendering, application and test code. The project has no configured lint command; formatting/semantic lint beyond TypeScript is not claimed.

## Code map

- `src/games/model.ts`: authored stage data, deterministic fixed-step physics, local-save validation.
- `src/games/render.ts`: original geometric Three.js scenes and fixed cameras. Mesh geometry/materials are shared across retries.
- `src/games/app.ts`: page lifecycle, multi-pointer controls, UI, audio and local persistence.
- `src/games/game.css`: portrait/landscape layouts and safe-area controls.
- `tests/games/`: physics/save unit tests and browser controls/flow/performance evidence.

Browser diagnostics are read-only `data-*` values on `#game`; they expose position and status so normal-input tests can observe progress. They do not allow setting state or bypassing gameplay. Browser stage completions send actual keyboard or Chromium touch input. Unit tests use direct state setup only to isolate collision and timing rules.

## Deployment and recovery

The existing `.github/workflows/deploy.yml` checks out main and deploys Astro's dist to GitHub Pages when main changes. Last verified successful production run before this work: `34554767460`, main `63f48b60aefb892ec167f4186b5b593ac1d10e65`, deployment log environment URL `http://www.pocketey.com/`. Both CNAME files and Astro's canonical site identify `www.pocketey.com`. Cloudflare's separate PR integration is present but its failed preview is not used as proof of production delivery.

The game branch does not change main, production workflow, domain, DNS, credentials or access settings. The existing four prototypes remain in draft PR #2 / `codex/pocket-cargo-playtest` at `955a79c2eb59d8ebc71f3d763f489846c2756611`.

Before publishing, obtain permitted live-domain access, verify the current domain and route behavior, and re-check main for concurrent changes. Publish through the existing main-triggered workflow after release checks. Verify both games, their `_astro` assets, game hub, homepage/news navigation and touch layout on the live origin. If a blocking regression appears, revert only the release commit on current main (preserving any concurrent changes), push that revert through the same workflow and verify recovery. Do not force-push main or change DNS as a rollback.
