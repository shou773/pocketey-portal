# Pocketey Japan — Human Review & Publishing

Pocketey's automated editorial engine may research official sources and create English article drafts, but it never publishes factual travel content automatically.

## Daily flow

1. The Editorial Engine runs automatically each morning at about **07:17 JST**.
2. It collects approved official-source updates and scores them for traveler value.
3. Strong `publish` candidates may be converted into Markdown articles under `src/content/news/`.
4. Generated articles always have:
   - `draft: true`
   - `reviewStatus: "needs-review"`
   - an HTTPS `sourceUrl`
   - an `eventKey` used to prevent duplicate articles for the same underlying event.
5. Follow-up official bulletins for the same event should refresh the existing unpublished draft instead of creating another article.
6. A human reviews the source and article before publication.

## Review checklist

Before approving a draft, verify:

- The headline accurately reflects the official source.
- Dates, times, prices, routes, areas and numerical values match the source.
- A forecast or possible disruption is not described as a confirmed disruption.
- JMA terminology has not been upgraded into a stronger `warning`, `advisory` or `alert` unless that formal status is explicit in the source.
- The article explains what an international traveler should actually do.
- Safety-critical articles do not contain unnecessary affiliate promotion.
- The source URL is the correct primary official source.

## Publishing a reviewed article

Open GitHub Actions and run **Publish Pocketey Draft**.

Enter the full repository path, for example:

`src/content/news/2026-09-05-example.md`

Then set the confirmation field to `YES`.

The workflow will:

1. Confirm the file is currently `draft: true`.
2. Require an HTTPS official `sourceUrl`.
3. Change the article to `draft: false` and `reviewStatus: "approved"`.
4. Run the Astro production build.
5. Commit and push only if the build succeeds.

The normal GitHub Pages deployment workflow then publishes the article.

## Guardrail

Do not bypass `draft: true` for AI-created factual travel articles. Automation assists research and drafting; publication remains a human editorial decision.
