# Audio implementation checkpoint (not a publish candidate)

The four-game release includes real sampled Kenney CC0 effects and a shared
page-scoped audio owner. Music acquisition is blocked: a normal-proxy request
for `https://opengameart.org/content/space-adventure` returned
`URLError(OSError('Tunnel connection failed: 403 Forbidden'))` on 2026-10-08.
No alternate network route was used. Music URLs remain deliberately unpopulated.

Effects use 9 selected samples, not the full archives. `public/games/audio/SOURCES.json`
records original and delivered hashes, lengths, sizes and processing. Original
Kenney license files are included unchanged. Delivered mono 24kHz PCM WAVs total
259,732 bytes; this format is decoded by Web Audio and requires no OGG support.

The mix caps effects at ten simultaneous voices, two per cue. Shot/contact
cooldown is 100ms; warning is prioritized over ordinary contacts. Each WAV is
normalized to at most -12dBFS before short edge fades; effects bus gain is at
most .24, music bus at most .2, master .85. Even ten maximum-amplitude effects
plus a full-scale music sample have a theoretical bound of about .683 (-3.3dBFS),
before interpolation/codec error. This conservative bound is not a substitute
for true-peak measurement of actual final play captures.

Cue map uses actual gameplay events: Orbit/Amber start, jump, land, clear/death;
Pulse auto-fire, scored enemy hit, warning-lane appearance, shield damage,
clear/death; Tilt brake engagement intervals, fall and clear. No new gameplay
features were added for sound. Existing Sound ON/OFF remains one tap. A separate
volume dialog offers Music/Effects sliders and individual mute, pauses play and
leaves an explicit Resume action. Preferences are stored per game under
`pocketey-audio-v1`, initialized from legacy sound/mute flags without changing
progress keys. Resetting Orbit/Amber also resets their audio preferences only.

Paused, hidden, menu, result and WebGL-loss paths stop music. Hidden pages suspend
the AudioContext; normal navigation disposes it. Asset/context failures are caught
and never change physics or save progress. Audio begins only after input.

Pending acceptance: acquire and verify licensed BGM originals; assess loop seams,
codec compatibility and final mix peaks; record actual gameplay with audio; run
all four gameplay and cross-browser/lifecycle checks on the final candidate.
No direct auditory quality claim has been made. The reference soundtracks guide
roles and thematic consistency only; none of their audio is reused.
