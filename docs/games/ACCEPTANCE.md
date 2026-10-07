# Release acceptance

- [ ] All six stages completed in rendered browser via normal keyboard/touch controls, without state writes, teleport or invulnerability.
- [ ] Failure, instant retry, clear, unlock, next, replay; repeated restart cycles without extra loop speed/events.
- [ ] Fixed-step motion agrees at 30/60/120 Hz; jump buffer/coyote and collisions covered by meaningful tests.
- [ ] Multi-touch move+jump, cancel/release, focus loss and pause clear held inputs.
- [ ] Portrait/landscape layout, actual WebGL screenshots, readable hazards and landing surfaces.
- [ ] Reload/reopen best/unlock/settings; blocked/corrupt storage safe; reset confirmation scoped to new games.
- [ ] Build and TypeScript checks, applicable tests at final commit; unavailable checks explicitly unverified.
- [ ] Performance measured with browser/version, viewport, renderer and hardware/emulation limitations. Provisional threshold: >=45 rendered fps and p95 <=40ms on available test browser, with 60fps target. Real phones explicitly unverified unless tested.
- [ ] Deployment mechanism and material gaps reported before public release; production routes/assets/navigation checked after release. Roll back blocking regression.

No universal device performance or physical mobile readiness claim from emulation alone.
