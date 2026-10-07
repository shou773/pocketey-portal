# Release candidate — not published

## Deliverable

- Orbit Ribbon: `/games/orbit-ribbon/`
- Amber Step: `/games/amber-step/`
- Discovery hub: `/games/`, linked from the existing site header on desktop and mobile.

These paths are built locally. They are **not asserted to be available on pocketey.com yet**.

## Test conditions

Cloud Linux x86_64, AMD EPYC 9V74 virtual CPU (5 logical CPUs exposed), Node 24.19.0. Chromium 151.0.7922.173 launched headlessly through Playwright. WebGL renderer: ANGLE / Vulkan 1.3.0 / SwiftShader Device (Subzero), software rendering. Desktop keyboard context 1280x720, DPR 1. Mobile-emulated context 390x844, DPR 1, isMobile + hasTouch, Chromium CDP multi-touch. Responsive checks additionally cover 320x568, 844x390 and 1440x900. This is not physical phone or Safari testing.

Release threshold chosen before final testing: average rendered rAF cadence >=45fps, p95 interval <=40ms on this software-rendered cloud environment; 60fps target. Each game's stage 3 is measured during ordinary-input play (200 rAF samples; first 10 discarded). The renderer batches static meshes, shares geometry, caps target pixels at 450,000 and DPR at 1.6, and uses diffuse lighting. Browser/OS compositing and automation overhead are included. Results are reproducible measurements, not a universal hardware claim.

## Validation status

Final results and screenshots are recorded in the evidence directory and the GitHub quality artifact when available. Browser checks cover all six stages via actual keyboard and touch input, stage unlocking, next/replay, saves across reload/reopen, sound setting, fall/retry, pause/focus input clearing, 20 restarts, constant geometry counts, touch cancellation, simultaneous movement+jump, orientation/layout and existing navigation.

Six unit tests cover fixed-step equivalence at 30/60/120Hz, coyote time, jump buffering, failure/collision, reachable courses and corrupt-save sanitation. No debug teleport or invulnerability is used for browser completion evidence.

`npm run check:games` and `npm run build` are required. Whole-site `npm run check` reports 48 errors solely in the unchanged legacy `src/pages/contact.astro`. Its source is byte-identical to baseline main. Those errors are **not passed or fixed by this work**. No pre-existing lint script is configured; separate lint is unverified.

## Publication blocker and remaining gaps

Both `https://pocketey.com/` and `https://www.pocketey.com/` fail from the execution environment with `curl: (56) CONNECT tunnel failed, response 403`, proxy response `server: envoy`. An escalated read attempt produced the same result. This is an environment network-layer denial, not a verified response from the website. The environment has network enabled but exposes no destination-allowlist editor. Permitted outbound HTTPS access to those two hosts is needed to verify production. No alternate route is used to circumvent that restriction.

Authorized GitHub read tools verified the existing successful main-to-GitHub-Pages deployment and its www.pocketey.com environment URL (see README). Main integration and publication remain pending until production verification can be performed. No DNS, security, persistent credentials or Sites deployment was changed.

Physical iOS/Android, Safari/WebKit, Firefox, mobile thermal/battery behavior, and live-origin route/asset checks are unverified. The optional WebKit download was denied by the environment with HTTP 403 `Domain forbidden`. Do not label this a universally mobile-ready release.
