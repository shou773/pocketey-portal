# pocketey.com

A single tool: the volumetric weight calculator for parcels sent from Japan,
in five languages (en, fr, zh, ko, ja).

## How this is deployed

Cloudflare Pages project `pocketey-portal`, connected to this repo.

- **Build command:** *(empty — no build step)*
- **Build output directory:** `dist`

`dist/` is committed to the repository on purpose. Pages serves those files
directly. There is no Node, no npm, and nothing that can break on its own in
two years' time. That is the point.

## Making a change

Text lives in `strings.json`, one object per language.
Layout lives in `build.py`. Calculator logic lives in `calc.js`.
Styling lives in `site.css` (inlined into each page at build time).

    python3 build.py      # regenerates dist/
    git add -A && git commit -m "..." && git push

Pages redeploys automatically on push to `main`.

## Structure

    /                       redirects to the visitor's language
    /en/ /fr/ /zh/ /ko/ /ja/
        index.html          the calculator
        privacy.html
        disclosure.html
    /sitemap.xml            15 pages, with hreflang alternates
    /robots.txt

Every page carries hreflang alternates for all five languages plus
x-default, and a self-referencing canonical.

## What deliberately isn't here

Duty thresholds, carrier prices and proxy-service fees. All three moved
during 2025-2026 — the US suspended its $800 de minimis, and the EU replaced
its €150 threshold with a per-item charge from July 2026. Publishing figures
like these means maintaining them forever.

The divisors — 6000 for Japan Post, 5000 for the express couriers — are the
only numbers on this site that stay true without upkeep. That is why they are
the only numbers on this site.

## Analytics

Cloudflare Web Analytics. The privacy pages promise a cookieless script that
does not identify visitors; keep that promise or change the wording in
`build.py` (the `PRIVACY` table).
