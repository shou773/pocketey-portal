# Bilingual game portal — independent review ready

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

Final runtime candidate: `00cfbcb5c2c54970510220d20c0ba1d0a4f284dc`. [Exact-SHA CI 37640758247](https://github.com/shou773/pocketey-portal/actions/runs/37640758247) succeeds: 7 model tests, 15 Chromium game cases, 10 WebKit/Firefox cases, and 12 portal cases, with no skipped/flaky cases. Build and both type checks pass. [Downloaded reports, performance samples, screenshots and build inventory](evidence/ci-00cfbcb/) are retained in this PR. Portal image review includes Japanese/English phone layouts, Japanese desktop, English all-clear, and WebKit landscape gameplay. A footer specificity defect found in image review was corrected in the final runtime commit.

All four Chromium stage-3 desktop/touch performance samples are approximately 60fps with p95 16.7ms. The fixed-baseline initial-segment comparison retains all 24 samples: final candidate desktop 54.07–60.00fps and phone 60.00fps, p95 16.7–16.8ms. Baseline desktop spans 42.23–60.00fps. This diagnostic starts stage 1 and is not a substitute for the full-stage performance gate.

Earlier CI `37640344761` on `19f39d5` also passed all tests, but its initial-segment desktop candidate samples were 22.22–38.52fps against baseline 13.33–47.41fps; its ordinary desktop stage-3 samples were 45.60–46.53fps. [Raw earlier comparison](evidence/initial/ci-19f39d5-performance.json) is retained. The subsequent change affects the portal footer only, not the game runtime; these differing observations are not attributed to a performance fix. They show substantial cloud software-renderer variability and do not establish physical-device performance. No threshold was lowered, no random retry was requested, and no failing result was discarded.

Release remains blocked on the parent's independent review of this candidate. Production is still `34ee2de`; no portal merge/deployment has occurred. Rollback is that existing GitHub Pages release. Deployment remains `.github/workflows/deploy.yml` (main push, Astro build, Pages deployment); after review, verify the exact merge SHA's deployment and live bilingual routes, retired-route 404s, navigation, game controls and save compatibility. The separate Cloudflare Pages integration historically fails and is not the production Pages path.

Initial build passes and generates 8 pages (including custom 404), with no news output. Whole-project `astro check` now has **0 errors, 0 warnings, 5 hints**; the previously recorded 48 Contact errors are resolved within the authorized Contact rewrite. Strict game types pass.

Initial portal regression: **10/11 pass**. The failed English Amber stage-3 run hit the final spike (`x=45.958`, grounded, 7 jumps). Its input trace was not captured, so the cause is not asserted. No physics, input timing thresholds or performance gates were changed in response. A follow-up diagnostic adds per-stage input traces. It repeats the final-spike failure at x45.958 with y0.471 and 8 jumps: the last jump was requested at sampled x45.333 after 74ms state-read and 54ms input-call latency; a preceding gap read took 213ms. This supports late automation delivery under the local software renderer, not a proven language/physics fault. Both failures are retained; no random retries or gameplay threshold change is used. Exact-SHA CI must validate the normal-input run. Original failure/report remain in [initial evidence](evidence/initial/).

The controlled performance baseline is the actual current UI release `34ee2de`, not the older news-era game build. Final code-SHA CI includes ordinary Japanese game regression (15 Chromium), 10 WebKit/Firefox cases and 12 portal tests, including ordinary English completion, language precedence/storage fallback, native small-screen game controls, 404/sitemap/internal links, save compatibility, unsupported-WebGL fallback and mocked Contact behavior. All final CI cases pass. The follow-up local full matrix remains 10/11; final targeted layout/navigation/404 cases and unsupported-WebGL fallback pass. CI success does not erase the local failures or prove human reaction fairness: the ordinary-input controller reads diagnostic state to establish solvability.

## UI release already verified separately

UI PR #4 was independently approved, merged as `34ee2de`, and deployed via [Pages run 37636174290](https://github.com/shou773/pocketey-portal/actions/runs/37636174290). Postmerge game quality run `37636174305` succeeds. Published JS/CSS and icon/license bytes match the verified UI build.

Public-URL Chromium 151 with WebGL2/SwiftShader and the normal supported proxy independently confirmed both games' native injected-touch stage-1 clear, pause/resume, actual death/retry, unlock/personal-best and sound persistence after reload. [Live report and images](evidence/ui-release/). These are real website checks, not CI-only claims, and do not promise physical-device performance. The separate historical Cloudflare Pages check remains distinct from the successful GitHub Pages deployment.

## Next independent request

After this portal candidate is reviewed and published, improve the actual in-game player, platforms and background/sky in a separate 3D-art PR. See REQUESTS.md; this portal/UI work does not satisfy that art request by itself.

Official asset download access remains blocked: at 2026-10-07 15:03:26 UTC, after the user reported completing the host allowance, both `https://kenney.nl/assets/space-kit` and `https://kenney.nl/assets/platformer-kit` returned normal-proxy CONNECT 403 (`curl: (56) CONNECT tunnel failed, response 403`, envoy). Known required host is `kenney.nl`; any final ZIP host is still unresolved. No proxy bypass or alternative mirror was used. The existing environment has not demonstrated the updated access. Parent can provision the republished environment for isolated asset acquisition; no additional host is asserted until the official page can be read.
