# Six-game draft integration

This candidate combines the four game-art refreshes with two isolated prototypes. It is a draft integration, not a publication or a request to merge.

## Exact source snapshots

Base main: `7adf12ab464cfbb8e9d4e04917ad9f618a1a5f4b`

- PR #26: `65b56313e0d7419deacf38c285dce03673db25e8` (codex/orbit-capsule-ribbon)
- PR #28: `c4e2e9fbe682b929e018f5122e579a7d15ed8705` (codex/amber-step-sandstone-garden)
- PR #25: `0fc344754ab86e1ab41a74c98dfca1f802a78cd7` (codex/tilttrail-luminous-ceramic)
- PR #27: `3e42a1a537132393f5ff39a0c4dc34394c15d88a` (codex/pulse-drift-clear-coast)
- PR #23: `49f454ba157045692950178b45ce1a59f8eba542` (codex/alpine-drive-input-prototype)
- PR #24: `c14ba9804498f0e9bb47071c193d5c1d8de8a289` (codex/conveyor-toy-factory)

All source snapshots were read directly from GitHub before integration. Existing binary/evidence objects are reused by blob SHA. Historical evidence folders describe their respective candidate revisions; they are not proof that the combined head passed.

## Shared-file resolution

- `src/games/art.ts`: retain Orbit's procedural craft/platform asset selection and Amber's guarded lighting/sky palette changes.
- `src/games/render.ts`: retain Orbit craft/platform/shutter/station changes and Amber lighting, spike colors, and sandstone surface joints. Base-relative line changes were combined without choosing an entire side.
- `package.json`: union the Orbit art tests and Alpine scripts/model tests; also include Alpine scene and Conveyor model tests in the default unit command.

Other candidate paths are adopted unchanged. The published four-game catalogue, original game models/inputs/saves, production deployment workflow, domain configuration, and dependencies remain unchanged. Alpine and Conveyor retain `noindex,nofollow`; the existing sitemap filter excludes prototype routes.

## Integration verification

The existing Games quality workflow also runs on `codex/six-game-integration-draft`. It retains all existing quality/performance thresholds, old-four ordinary-input/save/audio gates and the existing four jobs. The existing new-games job additionally runs Alpine's rendering-isolated input suite and a real-WebGL ordinary-touch clear/save/retry/reload check.

The Conveyor PR workflow checks out the exact PR head and runs its existing model, type/build and browser gates. No permissions, secrets, security settings, deployment logic, or plan settings are expanded.

Use exact-head GitHub Actions results on the draft PR for the combined candidate's status. A passing source snapshot or earlier screenshot must not be reported as a combined-head pass. Alpine's added rendered test checks functionality on Chromium/SwiftShader, not hardware-device performance. The original input suite deliberately isolates rendering.

No main merge or production deployment is part of this integration.
