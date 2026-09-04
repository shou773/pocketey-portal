# Pocketey Japan editorial workflow

## Publishing rule

AI prepares research and drafts. A human reviews every article before publication.

- `draft: true` = not published by Astro
- `draft: false` = eligible for publication

Never change a draft to `false` until the source, dates, names, prices, restrictions and traveler implications have been checked.

## Editorial pipeline

1. **Discover** — monitor official Japanese tourism, transport, airport, government, weather and attraction sources.
2. **Filter** — keep items that materially affect an international visitor's decision, itinerary, cost, safety or convenience.
3. **Verify** — prefer the primary official source; use a second source when the claim is consequential or ambiguous.
4. **Draft** — write clear English for travelers. Explain what changed, who is affected, when it applies and what to do.
5. **Review** — human checks facts, framing, links and usefulness.
6. **Publish** — change `draft: true` to `draft: false` and commit to `main`.
7. **Update** — revise or add `updated:` when official information changes.

## Source priority

1. Government ministries/agencies and municipalities
2. JNTO and official tourism organizations
3. Railway, airline, airport and transport operators
4. Official attraction/event/hotel announcements
5. Reputable reporting for context only

Do not base operational travel advice on social posts, aggregator pages or AI summaries when a primary source exists.

## Article frontmatter

```yaml
---
title: "..."
description: "..."
date: 2026-09-04
category: "Travel Updates"
location: "Japan"
featured: false
draft: true
sourceLabel: "Official source name"
sourceUrl: "https://..."
---
```

Allowed categories are defined in `src/content.config.ts`.

## Review checklist

- Is this genuinely useful to an international traveler?
- Is the primary source authoritative and current?
- Are dates, times, prices and locations exact?
- Does the article distinguish confirmed facts from interpretation?
- Does it explain the practical traveler action?
- Is the headline informative rather than clickbait?
- Is the English natural and concise?
- Are affiliate links, if any, clearly disclosed and genuinely relevant?

## Automation target

The intended next-stage pipeline is:

`official sources -> AI relevance scoring -> source verification -> Markdown draft -> human review -> publish`

The automation should create drafts only. Publication remains a deliberate human decision.
