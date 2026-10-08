# One final TiltTrail desktop budget adjustment

Before: exact candidate 864febf7806fb7a2a8420db1a31799ada807b268, 240,000 pixels.
After: the production renderer in this candidate, 204,000 pixels (15% lower)
only when canvas width >= 1000 CSS pixels and the primary pointer supports hover/fine.
Touch/mobile retains 240,000. Geometry, camera, antialiasing, materials, lighting,
physics, course difficulty, DOM typography, controls and accepted audio are unchanged.

The one before/after PNG pair is exported directly from the production WebGL
canvas after selecting stage03 with its native menu button. Two ordinary render
frames are allowed before export. Both are ready at x=0,z=0 with identical CSS
viewport/canvas dimensions and read-only state/geometry counters. No model writes,
camera override, test-only resolution setting or extra low-resolution mode is used.
Canvas export isolates 3D readability from the native menu overlay.

Desktop CSS canvas:1280x650, viewport1280x800,DPR1. Framebuffer687x349→633x321.
Mobile CSS/state match and framebuffer367x653→367x653. JSON records retain both.
Visual inspection of both PNGs confirms the mint ball, orange drop edges and narrow
bends remain distinguishable; floating rocks are decorative, not collision hazards.
DOM text remains native resolution. This pair is not a new performance experiment.

The keyboard stage test now uses a genuine fine-pointer/non-touch desktop context;
previously the common hasTouch=true config also applied to keyboard tests. Touch
uses its own mobile/coarse context. The input driver, gates and game physics are
unchanged. Soft performance assertions still allow all save/reload checks, and CI
still runs/aggregates every game. This is the release's last rendering adjustment.

Local post-change native keyboard verification cleared all three stages, persisted
and reloaded identical bests/Sound ON, and had zero page errors. It retained its
performance failure:29.23fps,p95 83.3ms. local-after-keyboard.json keeps the full
intervals/framebuffer and functionality evidence. Exact final-SHA CI is required.
