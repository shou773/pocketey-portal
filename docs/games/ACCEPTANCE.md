# Release acceptance

- [x] All six stages completed in rendered browser via normal keyboard/touch controls, without state writes, teleport or invulnerability.
- [x] Failure, instant retry, clear, unlock, next, replay; repeated restart cycles without extra loop speed/events.
- [x] Fixed-step motion agrees at 30/60/120 Hz; jump buffer/coyote and collisions covered by meaningful tests.
- [x] Multi-touch move+jump, cancel/release, focus loss and pause clear held inputs.
- [x] Portrait/landscape layout, actual WebGL screenshots, readable hazards and landing surfaces.
- [x] Reload/reopen best/unlock/settings; blocked/corrupt storage safe; reset confirmation scoped to new games.
- [ ] Build and TypeScript checks, applicable tests at final commit; unavailable checks explicitly unverified.
- [x] Performance measured with browser/version, viewport, renderer and hardware/emulation limitations. Provisional threshold: >=45 rendered fps and p95 <=40ms on available test browser, with 60fps target. Real phones explicitly unverified unless tested.
- [ ] Deployment mechanism and material gaps reported before public release; production routes/assets/navigation checked after release. Roll back blocking regression.

No universal device performance or physical mobile readiness claim from emulation alone.

Build + game TypeScript + seven unit tests + twelve browser tests pass. Whole-site Astro check has 48 pre-existing errors in unchanged contact.astro; no configured lint task. Production deployment and live verification remain blocked by outbound domain access. See RELEASE.md for exact conditions and gaps.

Mobile-review regression additions: real WebGL loss/restoration injection with reload-only recovery and unchanged saves; both-game 320x568 menu/control scroll reachability; simulated notch insets; fixed-edge Orbit bypass collision test. Completion bots use read-only coordinates and do not demonstrate novice human reaction difficulty.
