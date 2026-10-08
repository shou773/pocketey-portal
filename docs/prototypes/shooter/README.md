# Pulse Drift — Prototype A / 新作A

Review branch: `codex/prototype-shooter`, based on published main `aa44ef3a2e6ab853f2c13a168e73dd0e56459907`. Route: `/prototypes/pulse-drift/`. This is an unlinked, `noindex,nofollow` review route. No deployment, main merge, portal navigation replacement, paid assets, new dependencies, accounts, ads, ranking, or payments were added. The existing sitemap integration would include this route if a reviewer later chose to build/deploy the branch; exclude prototype routes before any public release.

## 日本語仕様・遊び方

スマホ優先の3D縦スクロールシューティング。指を置いた位置からドラッグすると自機が相対移動し、射撃は自動。PCでは矢印キー／WASDで移動、Pで一時停止。白い中心（半径0.18）が自機の当たり判定。赤い弾と敵本体を避け、琥珀の予告線から1.3秒以内に離れる。シールドは各面4、被弾後1.35秒は無敵。終了画面から即再挑戦できる。

| 面 | 内容 | 制限時間 |
| --- | --- | --- |
| 1 夜明けの回廊 | 狙い弾＋ゆっくりした予告ビーム。導入から被弾リスクあり | 36秒生存 |
| 2 交差する信号 | 狙い弾と3方向弾の複合、ビーム間隔短縮 | 42秒生存 |
| 3 脈動の中枢 | 密度の高い複合攻撃、30秒でボス1体出現 | 48秒以内にボスの32シールドを破壊 |

全3面を最初から選択可能。日本語／Englishは既存言語設定に準拠。音は初期OFF、ボタンで切替。背景タブ・フォーカス喪失はポーズし、明示的に再開。自己ベストと音設定のみ、新専用キー `pocketey-pulse-drift-v1` に保存。既存ゲームの保存に触れない。

## English specification and controls

A mobile-first 3D vertical shooter built around one decision: line up your automatic shots while leaving incoming red bullets and telegraphed amber lanes. Drag relative to your initial finger position, or use arrows / WASD. P pauses. The white core has a 0.18-unit hit radius; ships have four shields and 1.35 seconds of grace after a hit. Amber lanes warn for 1.3 seconds, then fire for 0.5 seconds. Stages 1 and 2 require 36 / 42 seconds of survival. Stage 3 requires defeating one 32-shield boss before the 48-second deadline. The boss arrives at 30 seconds. A fatal hit takes priority over a simultaneous boss defeat.

All three stages are selectable immediately. Retry is immediate. Language uses the existing locale API. Sound starts muted. Background / blur pauses require explicit resume. Best scores and mute preference use a dedicated local save key.

## Reproduce locally

Requires Node 22+, npm, and a WebGL2-capable browser. From the branch checkout:

```sh
npm ci --cache /tmp/pulse-npm
ASTRO_TELEMETRY_DISABLED=1 npm run build
ASTRO_TELEMETRY_DISABLED=1 npm run preview -- --host 127.0.0.1 --port 4331
```

Open `http://127.0.0.1:4331/prototypes/pulse-drift/?lang=ja` or `?lang=en`. Development: `ASTRO_TELEMETRY_DISABLED=1 npm run dev -- --host 127.0.0.1 --port 4330`.

With the static preview running, run tests sequentially so different browser windows cannot steal focus or distort performance samples:

```sh
ASTRO_TELEMETRY_DISABLED=1 npm run check
npm run check:games
npx tsc --noEmit -p tests/prototypes/tsconfig.json
npm test
npx tsx --test tests/prototypes/shooter-model.test.ts
node tests/prototypes/ui.mjs
node tests/prototypes/play.mjs
node tests/prototypes/performance.mjs
node tests/prototypes/loss.mjs
```

Browser scripts use `/usr/bin/chromium`. Override with `PULSE_BROWSER=/absolute/path/to/chromium`. There is no CI-specific gameplay path. Gameplay tests send actual keyboard events or CDP touch events and only read serialized state diagnostics. They never inject coordinates into the engine, modify HP/time, unlock a cheat mode, or replace stage data. Their controller is automated, so successful runs prove input-path feasibility rather than novice human difficulty.

The isolated unit tests use direct state setup (including invulnerability in a spawn/schedule test) to verify mechanics. They do not prove survivability. See `VALIDATION.md` for exact evidence and limits.

## Code and limits

Only new files were added under `src/games/prototypes/shooter/`, `src/pages/prototypes/`, `tests/prototypes/`, and `docs/prototypes/shooter/`. The simulation is fixed-step and independent of Three.js. Geometries/materials are shared; pixel ratio is capped at 1.5; there are no shadows, postprocessing, downloaded art, CDN requests, or textures. Ray-plane projection maps drag coordinates to the same 3D combat plane in portrait and landscape. WebGL startup/loss shows a translated recovery panel.

Art is deliberately simple original geometry; this is a three-stage prototype rather than a finished content campaign. Small 320×568 screens need vertical scrolling to reach the footer / bottom menu; Launch, combat canvas and Pause are accessible, and Pause provides Stage select in landscape. Real iOS/Android devices, physical audio playback, BFCache restoration, and broad hardware GPU performance remain unverified. Losing WebGL requires reload. Save failures keep session records only. Stage 3 can require a few retries; no difficulty calibration with human novice players is claimed.

The static ZIP can be served with `python3 -m http.server 4331` from its extracted root. Open the same prototype route. It is a local review artifact, not a public hosted link.
