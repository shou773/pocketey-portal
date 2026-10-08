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

Additional checkpoint evidence: 15 Chromium audio/interaction checks passed,
including decoding all nine delivered WAVs and simulated hidden-page lifecycle.
Pulse's three stages cleared using both native keyboard and CDP touch input;
eight UI/lifecycle cases and idle-loss/retry passed. A 13-second actual Pulse
canvas capture with VP8 video + Opus audio was produced outside the repository
at `/workspace/asset-intake/audio/pulse-effects-play.webm`. FFmpeg measured its
SFX-only mix at -25.6dBTP/-42.8LUFS, max three simultaneous voices. This is a
technical recorder proof, not a final music mix or auditory quality endorsement.

Local WebKit/Firefox could not launch in this refreshed environment: WebKit
reported missing GTK4/Graphene/Harfbuzz ICU/Manette/Hyphen/GLES libraries; Firefox
reported that its temporary profile folder could not be found. CI installs the
required browser dependencies and will provide application results. The first audio checkpoint passed nine Chromium and nine WebKit checks in CI.
Four Firefox checks failed because its AudioContext remained suspended; the CI
runner now supplies a PulseAudio null sink for a working audio output clock.
This must be verified rather than accepted as an assumed environment cause.
The current head must pass the updated tests before acceptance. Tilt's imported 5px backdrop
blur was removed to comply with the portal's established compositing budget.
