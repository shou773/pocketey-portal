# Pocketey Editorial Engine v1

## Purpose

Editorial Engine v1 creates a human-review queue of fresh Japan travel developments. It does **not** publish articles.

The engine follows `EDITORIAL_PRINCIPLES.md` and uses the scoring model in `editorial_engine/config.json`.

## Current flow

1. GitHub Actions starts the Editorial Engine manually.
2. Gemini uses Google Search grounding to research recent Japan travel developments, including Japanese-language official sources.
3. Candidates are scored for traveler value, trip impact, source reliability, freshness, evergreen/SEO value and natural monetization fit.
4. The script validates the scores and requires an HTTPS primary source.
5. It writes two review files to `data/editorial/YYYY-MM-DD.json` and `.md`.
6. GitHub Actions commits the queue to the repository.
7. A human decides which candidates should become article drafts.

No candidate is automatically published.

## Required secret

In the repository, open:

**Settings → Secrets and variables → Actions → New repository secret**

Create:

- Name: `GEMINI_API_KEY`
- Value: a Gemini API key from Google AI Studio / Gemini API

Do not store the key in repository files.

## Running v1

Open:

**Actions → Pocketey Editorial Engine → Run workflow**

After completion, review the newest file in `data/editorial/`.

## Why the workflow is manual first

The first several runs should be inspected for editorial quality. Once the candidate selection is consistently useful, add a daily schedule. This avoids automating low-quality or irrelevant AI output before the editorial filter has been calibrated.

## Planned v2

After calibration:

`daily research → candidate queue → human selects → AI creates draft:true Markdown → human fact check/edit → publish`

Then add related-content recommendations and contextual affiliate/ad modules without changing the traveler-first editorial priority.
