# Release acceptance

- [x] All six stages completed in rendered browser via normal keyboard/touch controls, without state writes, teleport or invulnerability.
- [x] Failure, instant retry, clear, unlock, next, replay; repeated restart cycles without extra loop speed/events.
- [x] Fixed-step motion agrees at 30/60/120 Hz; jump buffer/coyote and collisions covered by meaningful tests.
- [x] Multi-touch move+jump, cancel/release, focus loss and pause clear held inputs.
- [x] Portrait/landscape layout, actual WebGL screenshots, readable hazards and landing surfaces.
- [x] Reload/reopen best/unlock/settings; blocked/corrupt storage safe; reset confirmation scoped to new games.
- [x] Build and game TypeScript checks, applicable tests at code 5e7b3c6; unavailable/global checks explicitly disclosed.
- [x] Performance measured with browser/version, viewport, renderer and hardware/emulation limitations. Provisional threshold: >=45 rendered fps and p95 <=40ms on available test browser, with 60fps target. Real phones explicitly unverified unless tested.
- [x] Deployment mechanism and material gaps reported before public release; exact d8bb9ca Pages deployment and live routes/assets/navigation verified. No blocking regression required rollback. See PUBLISHED.md.

No universal device performance or physical mobile readiness claim from emulation alone.

Current verified code **5e7b3c6**: exact-SHA CI run 37619942914 passes build/game types, 7 unit tests, 13 Chromium tests and 10 WebKit/Firefox tests. Publication is pending. [Updated evidence, environment differences and preserved failures](UPDATED-ENVIRONMENT.md). The following 0cbc1e4 result is historical.

Latest code 0cbc1e4: local build/game TypeScript/seven unit tests/five affected browser tests pass. Full CI passes 11/13 browser tests; two desktop performance assertions fail at 41.31/41.16fps against >=45fps. The earlier 95ed0c6 twelve-test matrix passed, but that does not override the latest failure. Whole-site Astro check has 48 pre-existing errors in unchanged contact.astro; no configured lint task. Production deployment and live verification remain blocked by outbound domain access. See RELEASE.md for exact conditions and gaps.

Mobile-review regression additions: real WebGL loss/restoration injection with reload-only recovery and unchanged saves; both-game 320x568 menu/control scroll reachability; simulated notch insets; fixed-edge Orbit bypass collision test. Completion bots use read-only coordinates and do not demonstrate novice human reaction difficulty.
