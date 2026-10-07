# Independent review and corrections

A separate reviewing agent inspected the isolated implementation and ran ordinary browser inputs without modifying the code.

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Releasing a keyboard key left an old movement target, adding ~1 world unit of drift | Clear target when the last keyboard key is released and no touch is active | Reviewer rechecked; keyboard-stop assertions pass at four viewport sizes |
| Fatal damage and boss destruction in the same fixed step could change `lost` to `won` | Victory is evaluated only while status is `playing`; fatal hit takes priority | Dedicated simultaneous-fatal/boss regression test passes |
| The drawn white core radius was 0.09 while collision radius was 0.18 | White core uses radius 0.18 and is aligned with the combat plane | Final touch/desktop screenshots inspected; model radius remains 0.18 |
| Unconditional disposal on pagehide could break BFCache restoration | Preserve the renderer on `pagehide.persisted`; pause on pagehide | Code reviewed; actual BFCache restoration remains unverified |

The reviewer additionally confirmed normal drag/release, keyboard stop, P pause/resume, and no horizontal clipping or start failure at 320×568, 390×844, 844×390 and 1280×800. The owner repeated UI validation at 1280×900 and the other three sizes, and completed all stages through both ordinary input paths. Pure-model invulnerability tests are explicitly separated from real-input completion evidence.

No shared or existing-game source files were changed by either the owner or reviewer.
