#!/usr/bin/env python3
"""Resilient entrypoint for scheduled Pocketey editorial research.

Gemini occasionally returns valid JSON that does not follow the requested
schema (for example, an explanatory object without a `candidates` array).
That should not take the entire scheduled pipeline down. In that case we
write an empty human-review queue for the run and let the next scheduled run
try again. Source/network/API failures raised by the engine itself are still
reported normally.
"""
from __future__ import annotations

import sys

import editorial_engine as engine

_original_normalize = engine.normalize


def safe_normalize(result, config, run_date):
    if not isinstance(result, dict) or not isinstance(result.get("candidates"), list):
        print(
            "Editorial AI returned JSON without a candidates array; "
            "recording an empty queue instead of failing the scheduled run.",
            file=sys.stderr,
        )
        return {
            "run_date": run_date,
            "status": "candidate_queue_only",
            "human_review_required": True,
            "run_summary": (
                "No editorial candidates were recorded in this run because the AI "
                "response did not match Pocketey's candidate schema. The next "
                "scheduled run will retry automatically."
            ),
            "candidates": [],
        }
    return _original_normalize(result, config, run_date)


engine.normalize = safe_normalize

if __name__ == "__main__":
    raise SystemExit(engine.main())
