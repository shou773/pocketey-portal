# Portal final review after visual approval

Latest publication alignment: [published models and Orbit candidate](PUBLISHED-ALIGNMENT.md).
Parent and independent visual review approved `13f26fa`. This final pass makes no additional change to the portal layout, cover scenes, title artwork or game runtime. The PR remains a draft and must wait for the remaining game-art releases and cover alignment before merge or publication. Library saving was not retried.

## Integration and tests

Current main `f110bd89cbdaa24b912b419e0f7feac372298b86` and the approved portal head combine without conflicts. `git merge-tree --write-tree` produced tree `4bfe958704ee830ae7e0daa737b8c24e7da809db`. Its contents were archived to an isolated temporary directory for production build and testing. Neither main nor this branch was merged as part of the check. [Integration record](evidence/final-review/integration.json).

- [Production build](evidence/final-review/build.log): pass; route and retirement guard pass.
- [Astro check](evidence/final-review/astro-check.log): 0 errors, 0 warnings, 6 existing hints.
- [Portal tests](evidence/final-review/portal-tests.log): 16 passed in 38.9s. Covers both-language responsive game links at 320–1440px, keyboard focus/activation, caption/play contrast, locale priority and blocked storage, current/retired routes and sitemap, internal links, mocked contact form behavior, unavailable-WebGL exit, all game public metadata and retired prototype redirects. The four full-stage-play and save/pause/recovery game tests are excluded; no long gameplay suite was manually repeated.

The blocked-storage navigation test now uses the existing visible footer About link: the compact mobile header intentionally hides its extra navigation. This is a test-selector update only. The contact tests intercept their external endpoints and do not submit real messages.

## Final browser audit

[Audit record](evidence/final-review/audit.json) checks both `/` and `/games/`, both languages, and 320×568, 390×844 and 1440×900. All four complete cards are visible, images and decorative title SVGs load, titles remain inside their images, there is no horizontal overflow, and language controls remain available. Native keyboard Enter opens help via its link and closes it via the details summary.

The cover, plain title and play link of every game were each clicked from both portal routes and both languages: 48 actual game-menu navigations and 48 actual returns to the game list, preserving language throughout. No gameplay was started. All 20 discovered localized portal internal links return HTTP 200, and no page JavaScript errors were observed.

Fresh production screenshots: [PC Japanese](evidence/final-review/desktop-ja.png), [PC English](evidence/final-review/desktop-en.png), [390px Japanese](evidence/final-review/mobile-ja.png), [390px English](evidence/final-review/mobile-en.png), [320px Japanese](evidence/final-review/small-ja.png), [320px English](evidence/final-review/small-en.png). The [approved four-cover and 200px sheet](evidence/title-pass/cover-sheet.png) is unchanged.
