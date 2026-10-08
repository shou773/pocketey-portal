# Approved portal release integration

Main `857bc1d9ae0006e32804e3b7e9f75b2d454d57fe` publishes all four game-art revisions. Its [Orbit Pages deployment](https://github.com/shou773/pocketey-portal/actions/runs/37761349242) completed successfully. Parent expressly authorized PR #17 integration, merge and Pages publication after that success, with no further design changes and no manual repetition of the long game suites.

The portal branch merged that main without conflicts at `6d20a8b49d147c23320489e777760ff2bd591eda`. Shared game source, game assets, game tests (including the bounded Pulse synchronization fix), dependencies and CI are byte-identical to main. Approved portal components, styles, cover PNGs and title SVGs are unchanged. [Preservation record](evidence/release-check/preserved-main.json).

[Production build and route guard](evidence/release-check/build.log) pass. [Nine focused portal checks](evidence/release-check/portal-focus.log) pass: both routes/languages and 320–1440px, keyboard focus and activation, caption/play contrast, language retention, internal links and all four public metadata checks. No long gameplay suite was manually repeated.

The [Amber Blender verification](evidence/amber-blender/verification.json) records successful normal landmark loading and byte-identical regeneration. [Other model comparisons](PUBLISHED-ALIGNMENT.md) remain valid: published Orbit is the checked integrated candidate, with other model/art sources preserved.

A preliminary HTTPS attempt in ordinary Chromium with default certificate validation stopped at `ERR_CERT_AUTHORITY_INVALID`. No certificate exception was used. This does not establish that the deployed website's certificate is faulty outside this execution environment. Post-publication browser verification will use the same strict TLS behavior and must report any remaining error rather than claim unobserved screens or links passed. Deployment and post-publication results are recorded separately in the release report.
