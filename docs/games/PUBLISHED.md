# Published games — 2026-10-07

- [Games hub](https://pocketey.com/games/)
- [Orbit Ribbon](https://pocketey.com/games/orbit-ribbon/)
- [Amber Step](https://pocketey.com/games/amber-step/)

PR [#3](https://github.com/shou773/pocketey-portal/pull/3) merged as **d8bb9ca99fcf82fb1a9348692d60d07e0888bc9c**. Its file tree is identical to evidence head edf7728, whose application/tests/workflows match verified code 5e7b3c6. [GitHub Pages run 37621058385](https://github.com/shou773/pocketey-portal/actions/runs/37621058385) built that exact merge SHA and reported deployment success at **12:27:39 UTC**. Publication used the unchanged existing GitHub Actions → GitHub Pages path. No DNS/security changes or substitute host were used.

At **12:29:09 UTC**, a fresh mobile Chromium context accessed the public HTTPS domain through the normal supported proxy. The root domain redirects to www.pocketey.com. Homepage, About, Contact, games hub and both games returned **HTTP 200**, with no page JavaScript errors, failed asset responses or horizontal overflow. Both games created WebGL2 contexts; native CDP simultaneous movement+jump produced positive movement and airborne player positions. Pause/resume, 390x844 portrait, 844x390 landscape, and homepage → games hub navigation were checked. Gameplay screenshots were inspected for correct projection, visible player/course and readable controls. This is a live smoke check, not a repeat of all six-stage acceptance tests.

The published JavaScript bundle returned 200 and matched the local tested application **byte for byte**: 542,472 bytes, SHA-256 `d3728ef20831aa81dd89936257263864a383201441e84f6bfda9cc5d6ce7bab3`. [Machine-readable live results, asset hash and screenshots](evidence/publication/).

Pre-release exact-code [CI 37619942914](https://github.com/shou773/pocketey-portal/actions/runs/37619942914) passed build/game TypeScript, 7 unit tests, 13 Chromium browser tests and 10 WebKit/Firefox tests. All six stages cleared through normal inputs. [Complete SHA-specific QA, earlier failures and limitations](UPDATED-ENVIRONMENT.md).

Physical iPhone/Android performance, thermal behavior and novice reaction fairness remain unverified. Linux WebKit is not physical iPhone Safari. Software-rendered cloud frame rates vary, and prior unsuccessful measurements remain preserved; publication does not claim that changing CI runners improved the product. The separate Cloudflare integration and the 48 unchanged legacy Contact-page type errors are not reported as passing.

No blocking live regression was observed, so rollback was not needed. Previous working deployment baseline remains **63f48b60aefb892ec167f4186b5b593ac1d10e65**. For a blocking product regression, revert merge d8bb9ca with mainline parent 1 and verify the resulting Pages deployment. The earlier prototype branch/PR #2 remains unchanged at 955a79c.

Any follow-up commit adding this publication record changes only documentation and evidence; it does not represent an application code change or a new browser-test execution.
