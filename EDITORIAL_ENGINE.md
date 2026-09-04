# Pocketey Editorial Engine

## Purpose

Pocketey Editorial Engine is a traveler-first research and drafting pipeline for fresh Japan travel developments.

It can automatically collect official information, score candidate stories and create unpublished English article drafts. It **does not automatically publish factual travel articles**.

The engine follows `EDITORIAL_PRINCIPLES.md` and uses the scoring model in `editorial_engine/config.json`.

## Current production flow

1. GitHub Actions runs the Editorial Engine every day at approximately **07:17 JST**. It can also be started manually.
2. The collector reads approved official feeds and web pages such as JMA, JNTO, rail, airport, tourism-agency and local-government sources.
3. Gemini analyzes only the supplied official-source items. Open-web Google Search grounding is not required for this workflow.
4. Candidates are scored for traveler value, trip impact, source reliability, freshness, evergreen/SEO value and natural monetization fit.
5. The queue is written to `data/editorial/YYYY-MM-DD.json` and `.md`.
6. Strong `publish` candidates may be turned into Markdown drafts under `src/content/news/`.
7. Generated articles always remain `draft: true` with `reviewStatus: "needs-review"` until a human approves them.
8. Stable `eventKey` metadata is used to detect the same underlying event across follow-up official bulletins. A new bulletin can refresh an existing unpublished draft instead of creating another article.
9. A human reviews facts, terminology, dates, numbers and traveler advice.
10. The separate **Publish Pocketey Draft** workflow can publish a selected reviewed draft only after explicit human confirmation and a successful Astro production build.

## Required secret

In the repository, open:

**Settings → Secrets and variables → Actions**

The following repository secret is required:

- `GEMINI_API_KEY` — Gemini API key from Google AI Studio / Gemini API

Do not store the key in repository files.

## Models and reliability

The default model is `gemini-3.1-flash-lite`. Temporary 429/5xx Gemini errors are retried, with a Flash Lite fallback available if the primary model remains unavailable.

The workflow is intentionally low-volume: candidate analysis plus at most two article drafts per run.

## Running manually

Open:

**Actions → Pocketey Editorial Engine → Run workflow**

After completion, review:

- the newest queue in `data/editorial/`
- any new or refreshed `draft: true` files in `src/content/news/`

## Human publishing

See `EDITORIAL_REVIEW.md` for the review checklist and the **Publish Pocketey Draft** workflow.

The publication guardrail is deliberate:

`official sources → AI research → scoring → draft:true article → human verification → approved publication`

Automation assists the editorial desk; it does not replace the final editorial decision.
