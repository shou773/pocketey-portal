# Orbit: one solid armored shutter visual trial

Early direction review only. Base main `9538edc3ff8e7c72362e4baab5b0f8331a2c49e8`, independent branch `art/orbit-armored-shutter`. Challenger stays rejected in separate evidence PR21; existing Kenney craft is retained.

[Model close-up](model-closeup.png) · [Actual normal phone camera on approach](mobile-approach.png)

One original Blender design replaces the tall box hazard with a solid industrial shutter: continuous warm armor face, darker full backing/side rails, stepped chamfered crown and sill, two slanted reinforcing strips, minimal amber warnings. Rectangular overall bounds deliberately communicate the original collider; face relief and small edge chamfers reduce the plain-box look without creating a round lump. This is an initial visual trial, not a claim that blockiness is eliminated or direction is approved.

Collision positions/dimensions, stage layouts, speed, physics, controls, camera, lights, ship, other games and difficulty remain unchanged. For the first 2×2.8×1 collider, rendered bounds are exactly X[-1,1], Y[0,2.8], Z approximately[-.5,.5] (floating-point noise <2e-8). A continuous solid backing spans the full width and height; seams and diagonal relief sit in front of an uninterrupted closed face, not openings. All existing width variants scale from the same unit model, preserving their assigned side lanes. Loading failure retains the original equipment boxes.

Original authoring source: `armored-shutter.blend`, reproducible with `blender -b -t 1 --python docs/release/orbit-shutter/create.blender.py`. No imported art or third-party material, texture, light, camera or animation. GLB 47,956 bytes / 588 triangles / four opaque source materials; converted to the current lightweight Lambert colors and merged into the existing static batch. One isolated shutter is one draw. Full stage1 phone frame remains9 draws, but submitted triangles rise7,724→11,252 (+3,528); no FPS/device improvement is claimed.

Phone390×844/DPR1, framebuffer390×690. Actual built game, native touch start, original callback advanced at60Hz solely for reproducible x≈9.3 approach capture; no physics state/camera writes. Close-up is a separate inspection view using the same two game lights. `capture.json` retains exact state/bounds/counts/errors; both final screenshots have0 page errors. One initial gray-door capture exposed a shell/face overlap and was discarded after fixing that geometry layering.

Game TypeScript and production build/portal checks passed. Full native avoidance/clear, fallback, saves/audio/cross-browser and performance remain pending direction review. No long CI, merge or publication. Inspection route is temporary, copied from `review.astro` only for local capture; it is removed from the product. `capture.mjs` uses locally served production `dist` at4352. No access/certificate/authentication bypass.
