# Bilingual game portal — review pending

Base production commit: `34ee2de4194180792ddee2ecc6905e634ee95c06` (approved UI PR #4). Branch: `codex/bilingual-game-portal`. This is a separate portal/news-retirement change. Do not merge before independent review of its code, images and exact-SHA CI.

## User-authorized changes

- Replace the former travel-news homepage with an actual two-game collection, gameplay screenshots, controls, stage goals/unlock/replay, local-save limitations and device/recovery guidance.
- Japanese/English controls on every portal page and each game's menus. Initial selection: explicit language URL, saved explicit preference, then Japanese for `navigator.language` beginning `ja`, English otherwise. Selection uses a separate `pocketey-language-v1` key and is carried in links as `?lang=ja/en`; canonical paths and existing game URLs remain unchanged. Blocked storage still permits page selection and explicit-language navigation. HTML `lang`, document titles, descriptions, image alt text, labels, stage names/hints, pause/results/reset/recovery copy follow the selection.
- Delete 11 old news articles, their six images, old news routes, unfinished guides, newsletter and affiliate placeholders by normal Git deletion. History is retained. Old URLs return 404 with an explanation and optional game link, not a blanket redirect. A build guard rejects retired source/output directories and retired sitemap entries.
- Replace About and starter Privacy with bilingual factual descriptions. No invented operator identity, retention period, legal guarantee or advertising approval claim. No ad/analytics scripts, ads.txt or review submission added.

## Contact and external systems

The existing public email, Turnstile site key/action, Worker endpoint, payload names and category values are retained. Form copy now describes game/site feedback; required name/email/message and optional page URL are disclosed in Privacy. Type-safe frontend code handles both languages, validation, token gating, success/failure and delayed/blocked challenge loading. Compact Turnstile dimensions avoid the official flexible widget's 300px minimum exceeding a short phone's inner form width. Changing language re-renders the widget and requests a fresh token; no verification is bypassed.

No Worker code, credentials, DNS, Cloudflare account/configuration or external data were changed. Contact tests mock Turnstile and intercept the POST; no real message is sent. Live delivery beyond the frontend is not claimed verified. Existing documentation sources: [Turnstile privacy addendum](https://www.cloudflare.com/turnstile-privacy-policy/) and [widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).

Current tracked workflows contain only Pages deployment and game quality checks, neither with a news-generation schedule. Private automation lookup found zero tasks. A remote workflow-list call is unsupported by the connected GitHub fetch API; no claim is made to have audited unknown external schedulers. The build guard prevents news from being republished through this source tree.

## Verification

Initial build passes and generates 8 pages (including custom 404), with no news output. Whole-project `astro check` now has **0 errors, 0 warnings, 5 hints**; the previously recorded 48 Contact errors are resolved within the authorized Contact rewrite. Strict game types pass.

Initial portal regression: **10/11 pass**. The failed English Amber stage-3 run hit the final spike (`x=45.958`, grounded, 7 jumps). Its input trace was not captured, so the cause is not asserted. No physics, input timing thresholds or performance gates were changed in response. A follow-up diagnostic adds per-stage input traces. It repeats the final-spike failure at x45.958 with y0.471 and 8 jumps: the last jump was requested at sampled x45.333 after 74ms state-read and 54ms input-call latency; a preceding gap read took 213ms. This supports late automation delivery under the local software renderer, not a proven language/physics fault. Both failures are retained; no random retries or gameplay threshold change is used. Exact-SHA CI must validate the normal-input run. Original failure/report remain in [initial evidence](evidence/initial/).

The controlled performance baseline is the actual current UI release `34ee2de`, not the older news-era game build. Final code-SHA CI includes ordinary Japanese game regression (15 Chromium), 10 WebKit/Firefox cases and 12 portal tests, including ordinary English completion, language precedence/storage fallback, native small-screen game controls, 404/sitemap/internal links, save compatibility, unsupported-WebGL fallback and mocked Contact behavior. Final results pending. The follow-up local matrix remains 10/11, with all localization, 320px, route and mock-Contact cases passing.

## UI release already verified separately

UI PR #4 was independently approved, merged as `34ee2de`, and deployed via [Pages run 37636174290](https://github.com/shou773/pocketey-portal/actions/runs/37636174290). Postmerge game quality run `37636174305` succeeds. Published JS/CSS and icon/license bytes match the verified UI build.

Public-URL Chromium 151 with WebGL2/SwiftShader and the normal supported proxy independently confirmed both games' native injected-touch stage-1 clear, pause/resume, actual death/retry, unlock/personal-best and sound persistence after reload. [Live report and images](evidence/ui-release/). These are real website checks, not CI-only claims, and do not promise physical-device performance. The separate historical Cloudflare Pages check remains distinct from the successful GitHub Pages deployment.

## Next independent request

After this portal candidate is reviewed and published, improve the actual in-game player, platforms and background/sky in a separate 3D-art PR. See REQUESTS.md; this portal/UI work does not satisfy that art request by itself.
