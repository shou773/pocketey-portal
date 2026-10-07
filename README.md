# Pocketey Games

A bilingual browser-game portal built with Astro and Three.js. Current games: Orbit Ribbon and Amber Step, three stages each. Touch and keyboard controls; local progress; no accounts, ads or analytics scripts.

## Development

```sh
npm ci
npm run dev
npm run check
npm run check:games
npm test
ASTRO_TELEMETRY_DISABLED=1 npm run build
npm run test:browser
npm run test:portal
```

`npm run build` verifies public routes and rejects retired travel/news source or build directories. Do not restore news publishing or newsletter placeholders. The former travel articles and images were removed with ordinary Git deletions; history is retained.

## Language and storage

The same route supports both languages. Explicit `?lang=ja` / `?lang=en` or the visible language switch takes priority; otherwise the saved preference is used, then Japanese for a Japanese browser language and English for others. Preference key: `pocketey-language-v1`. Existing game saves remain at `pocketey-orbit-amber-v1` without migration.

## Contact

The existing form posts to the existing Cloudflare Worker, protected by the existing Turnstile site key. The payload field names and category values are preserved. No external account, routing, secrets or Worker code is managed by this repository update. Tests mock submission and never send messages to the real endpoint. The page retains `contact@pocketey.com` as its established alternative.

## Deployment

Main is built by `.github/workflows/deploy.yml` and deployed to GitHub Pages at https://www.pocketey.com. Cloudflare Pages is a separate historical integration; its failing checks must not be reported as GitHub Pages deployment failure or as fixed without evidence.

There are no scheduled news-generation workflows in the current tracked workflow files. Build retirement checks prevent accidental republishing from this source tree. `/news/*`, `/guides/` and the former affiliate page now return 404 rather than redirecting unrelated articles to the homepage.

See `docs/games/` for game QA, asset licenses and publication evidence; `docs/portal/` for the bilingual migration report. Advertising activation, ads.txt and review submission are outside this update.
