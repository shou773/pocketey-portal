# Pocketey Japan

Minimal Astro + GitHub Pages MVP for **pocketey.com**.

## What is included

- Editorial-style responsive homepage
- Markdown-based travel news collection
- Individual article pages
- News index and Guides placeholder
- About / Privacy / Affiliate Disclosure
- Canonical URLs, meta descriptions, Open Graph, robots.txt
- Automatic sitemap via `@astrojs/sitemap`
- GitHub Pages deployment workflow
- `draft: true` publishing gate for human approval

## Local setup

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Add an article

Create a Markdown file in `src/content/news/`, for example:

```md
---
title: "JR announces ..."
description: "One-sentence traveler-focused summary."
date: 2026-09-05
category: "Transportation"
location: "Tokyo"
featured: false
draft: true
sourceLabel: "JR East"
sourceUrl: "https://example.com/official-source"
---

## What changed?
...

## Who is affected?
...

## What should travelers do?
...
```

Keep `draft: true` while reviewing. Change to `draft: false` to publish on the next GitHub push.

## GitHub Pages

1. Create a public GitHub repository.
2. Push this project to the `main` branch.
3. In **Settings → Pages**, set the source to **GitHub Actions**.
4. The included workflow will build and deploy the site.

## Custom domain: pocketey.com

This project is configured for `https://www.pocketey.com`.

Recommended setup:

- `www.pocketey.com` → CNAME to `<your-github-username>.github.io`
- Configure the apex `pocketey.com` using the current GitHub Pages DNS instructions from your registrar.
- Add `www.pocketey.com` as the custom domain in GitHub Pages settings.
- Turn on **Enforce HTTPS** after DNS resolves.

Do not change DNS records until you confirm where `pocketey.com` currently points.

## Before commercial launch

- Replace demo articles with verified real reporting.
- Review Privacy Policy and Affiliate Disclosure for actual services used.
- Add a public contact method.
- Connect Google Search Console.
- Add analytics only when you are ready to update privacy/cookie handling.
- Verify each affiliate program's terms before inserting affiliate links.
