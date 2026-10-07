# TiltTrail — isolated prototype B

Review route: `/games/prototypes/tilttrail/?lang=ja` or `?lang=en`.
Base: `aa44ef3a2e6ab853f2c13a168e73dd0e56459907` (current main when work began).
Branch: `codex/prototype-ball`. This is a draft for review; no main merge or production release is included.

## 日本語の仕様・操作

浮かぶ道をボールで転がり、オレンジの縁から落ちずに光るゲートへ到達する3Dアクションです。自動前進を左右操作で操り、曲がる前に減速します。左右の入力を離しても少し慣性が残り、逆方向への入力で止められます。ジャンプや障害物はありません。

- 左右ボタン、← →、A / D：左右に転がす。
- ブレーキ長押し、Space、↓、S：減速。指を離すと通常速度へ戻ります。
- 一時停止ボタン、Esc / P：停止・再開。フォーカスを失った場合は一時停止します。
- 3ステージ：導入の「はじめの曲がり道」、切り返しの「波の回廊」、減速判断が必要な「空の尾根」。すべて最初から選択できます。
- 落下後は0.7秒の短い演出からリトライ。クリア時にタイムと自己ベストを表示します。
- 音は初期OFF。音ボタンの操作後のみ、短い自作の音を使用します。
- 言語は既存ポータルと共通。記録と音設定は独立キー `pocketey-tilttrail-v1` に保存します。既存2作品の記録は変更しません。

## English specification and controls

Roll a ball along floating trails and reach the glowing gate without crossing the orange edges. Forward movement is automatic; steering controls lateral momentum, while holding the brake slows the ball for bends. Counter-steering catches momentum. There are no jumps or extra obstacles.

- Left / right touch buttons, arrows, A / D: steer.
- Hold BRAKE, Space, down arrow, or S: slow down. Release to regain speed.
- Pause button, Esc / P: pause or resume. Losing focus pauses gameplay.
- Three available stages: First bends (introduction), Wave corridor (counter-steering), Sky ridge (narrow bends and braking decisions).
- A 0.7-second fall animation leads to retry. Finishing shows completion time and personal best.
- Sound starts off; short synthesized tones begin only after a user gesture enables sound.
- Language follows the existing portal. Progress and mute settings use the independent `pocketey-tilttrail-v1` key.

## Reproduce locally

Requires the repository's Node/npm dependencies and `/usr/bin/chromium` for the isolated Playwright config. No dependency or lockfile changes were made.

```sh
npm ci --cache /tmp/pocketey-ball-npm
npx tsx --test tests/prototypes/ball/model.test.ts
npm run check:games
ASTRO_TELEMETRY_DISABLED=1 npm run check
ASTRO_TELEMETRY_DISABLED=1 npm run build
npx playwright test --config tests/prototypes/ball/playwright.config.ts
ASTRO_TELEMETRY_DISABLED=1 npm run preview -- --host 127.0.0.1 --port 4335
# Open http://127.0.0.1:4335/games/prototypes/tilttrail/?lang=ja
```

The config is separate from the existing games and CI. Its controller sends real keyboard or Chromium CDP multi-touch events and reads diagnostic `data-*` values. It never sets player state, changes time, or skips collisions. Every stage clear trace records sampled position, speed and final status. Unit tests set state only to isolate support and finish boundaries. Layout and fallback tests exercise 320×720 portrait and 844×390 landscape in both languages.

## Code and design

- `src/games/prototypes/ball/model.ts`: three authored continuous trails, fixed 120Hz simulation, support/drop/finish rules, save sanitation.
- `render.ts`: original geometric Three.js scene, shared materials, instanced decorations, at most 1.5 device pixel ratio and 240,000 internal pixels, no shadow maps, postprocessing or asset downloads. CSS UI remains native resolution.
- `app.ts`: independent lifecycle, multi-pointer and keyboard input, language integration, gesture audio, save and menus. Diagnostics are read-only.
- `style.css`: scoped standalone page layout, safe-area padding and compact screen rules.
- `src/pages/games/prototypes/tilttrail.astro`: the only added route; no hub registration or existing component edits. The route has `noindex,nofollow`.

Trail geometry and collision use the same interpolated knot data. Width changes are gradual; the ball starts on a wide straight section. Forward speeds are 5.8m/s normally and 2.15m/s when braking, reached smoothly. Lateral acceleration is 13m/s² with exponential drag of 2.8/s. A sphere loses support when its center exceeds half the road width minus 0.35 of its radius. Off-road finish crossing always falls before a clear can occur.

All visual shapes and audio tones are authored for this prototype. No paid material, account, service, physics library, CDN, analytics, ads, ranking or registration was added. Existing Three.js MIT dependency and portal locale/favicon are reused.

## Validation and evidence

Final results are in `QA.md`. Screenshots and normal-input play traces are in `evidence/`. Raw Playwright JSON goes to ignored `tests/prototypes/ball/test-results/ball/report.json`; a compact checked-in summary accompanies the evidence.

## Known limits

- This is a small custom kinematic simulation, not a rigid-body sphere simulation. Slopes, jumps and device tilt are outside its scope.
- Headless Chromium uses SwiftShader in this environment. Reported timings are local observations, not a phone GPU guarantee. Real iOS/Android devices and physical notches remain untested.
- Blur, touch cancellation and page return are tested. The bfcache return test dispatches lifecycle events; real mobile operating-system suspension is untested.
- Records have no cross-device synchronization. Unavailable storage keeps progress in the current tab and shows a message. WebGL creation/loss requires reloading in a supported browser.
- No human difficulty study has been conducted. All six mode/stage combinations are verified by discrete normal-input controllers; their optimal route knowledge is stronger than a first-time player's.
- The standalone prototype route is added to the local static build and therefore to the unchanged sitemap generator's output. It is not linked from the public game hub. `noindex` is metadata, not access control. A deployment/release decision needs a separate review.
- No static build ZIP or Library upload is part of this delivery. Source, evidence and the local static build are available; the draft PR is the review deliverable.
