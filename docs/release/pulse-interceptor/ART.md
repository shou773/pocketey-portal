# Pulse Drift: first silhouette and location review

Base public main: `a443ec37c33cae22021c82b7b20f3fb6e62f02c6`. This is an unmerged first visual candidate, not a finished release. Only Pulse production rendering changes.

The independent original interceptor has one pointed nose, swept blue wings, dark canopy and paired engines with cyan exhaust. Existing enemy roles gain narrow scout, broad fan fighter and armoured twin-barrel boss silhouettes. All are authored colored low-poly meshes in code, with one combined geometry per hull. No borrowed artwork, new asset/dependency or postprocessing.

The location is a coastal industrial canyon: subdued water channel, stepped rock banks, serviced landing platforms, rounded generators and pipes. The combat centre stays quiet; taller structures sit at the sides. Repeated props are instanced. Existing model, controls, hit detection, difficulty, stages, camera, audio, saves and other three games are unchanged. Existing brief damage flash/blinking remains; final effects polish is pending visual direction review.

## Ordinary mobile play comparison

390×844, DPR1, actual route and controls, stage3, sound ON, native touchStart/move18CSSpx left/end after120ms. No state writes, DOM/camera overrides, pause or effects suppression. Capture times differ slightly (~4.02–4.13s baseline and4.15–4.35s candidate); these are ordinary play comparisons, not pixel-aligned identical simulation frames. Both have HP4. Adjacent JSON records states/render counters and no page errors.

| Published baseline | First candidate |
| --- | --- |
| ![Published Pulse native mobile play](evidence/before-mobile-native-play.png) | ![Candidate Pulse native mobile play](evidence/after-mobile-native-play.png) |

Additional warning captures retain actual amber lane/red projectiles and native warning text. The candidate warning shot catches the existing invulnerability blink, so the ordinary4s screenshot above is the primary silhouette comparison.

Harness: `scripts/capture-pulse-interceptor.mjs before|after`, run against the corresponding checkout using `PULSE_ART_BASE_URL`, `PULSE_ART_SHA`, optional `PULSE_ART_EVIDENCE`. It uses the existing local Chromium/SwiftShader. TypeScript game check and diff whitespace check passed. Long exact-SHA CI has deliberately not been started before art review; this branch is outside the existing automatic push branch list.

## Requested official references: blocked

On2026-10-08 the existing normal HTTPS proxy rejected all four supplied Konami URLs with `Tunnel connection failed: 403 Forbidden`. Web viewing also rejected the TwinBee redirects to img.konami.com; the Gradius image opens returned no viewable image content. The images were not actually viewed. No restriction bypass or source image copying was attempted. This candidate therefore follows the parent's written coastal canyon/interceptor direction rather than claiming a verified visual study of the supplied images.

- Town: https://www.konami.com/products_master/jp_publish/dl_detanatwinbee_arcade_c/jp/ja/images/ss01.png
- Canyon: https://www.konami.com/products_master/jp_publish/dl_detanatwinbee_arcade_c/jp/ja/images/ss03.png
- GradiusII: https://www.konami.com/games/gradius/s/img/en/gradius2_01.jpg
- GradiusIII: https://www.konami.com/games/gradius/s/img/en/gradius3_01.jpg

Next: parent reviews the actual mobile silhouette/location comparison first. No merge or publication before review. Boss silhouette, desktop readability, bounded effects polish and functional/performance regression verification remain for the accepted direction.
