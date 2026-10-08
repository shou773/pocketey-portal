# Contact and gap visibility — two-point revision

Review base: `258e880b53ed39ab20d1bf120c8c0f492221379f`, draft PR13. This follow-up addresses the two requested image-review corrections before performance testing.

The Blender arch and procedural fallback both sit in a shared formation with two reused, faceted rock supports. The feet intersect the upper shoulders; the supports continue below the view instead of ending against the canyon wall. They use the arch's existing opaque static batch and material. The original Blender GLB is unchanged.

The six near decorative islands, trees and small rock caps are removed. Those flat mesa tops could align with playable gaps and suggest a lower landing. The distant canyon, arch formations and small shrubs on actual platforms remain; the target stage3 gap now shows continuous background between its two playable endpoints.

| Requested scene | Review base | Revised |
| --- | --- | --- |
| 844×390 stage1 start | [Before](../after/844-start.png) | [After](after/844-start.png) |
| 390×844 stage3 edge spike / lower landing | [Before](../after-stage3/390-edge-spike.png) | [After](after-stage3/390-edge-spike.png) |

The existing capture script is reused with `AMBER_REVIEW=contact`; only these two images are emitted. It uses native start/stage selection/keyboard input and the same held-rAF timestamps. [Start diagnostics](after/capture.json) / [stage3 diagnostics](after-stage3/capture.json) retain the buffers, state, asset adoption and errors. Position/grounding/jumps match the review base: start x0/y0; edge spike x17.833/y.700, grounded, two jumps. Framebuffers remain844×341 and390×690. Both scenes have no runtime exception and still adopt the Blender arch.

Stage1 submission is9 calls/5,538 triangles versus10/6,918 at the review base; stage3 is9/6,522 versus10/7,902. These are submitted geometry counts, not an FPS or performance pass. Game TypeScript and production build/route checks pass. No physics, collider, camera, stage, difficulty, input, audio, save, common UI, dependency or workflow code changes. Performance measurements and long CI are deferred to the next requested step; the earlier42.26fps diagnostic remains unresolved and retained.

```sh
AMBER_REVIEW=contact node docs/games/evidence/amber-depth/capture.mjs after
AMBER_REVIEW=contact AMBER_STAGE=3 node docs/games/evidence/amber-depth/capture.mjs after
```
