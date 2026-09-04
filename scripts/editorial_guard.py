#!/usr/bin/env python3
import json
import pathlib
import re

from editorial_engine import write_markdown

ROOT = pathlib.Path(__file__).resolve().parents[1]
QUEUE_DIR = ROOT / "data" / "editorial"


def append_reason(item, message):
    current = str(item.get("reason") or "").strip()
    if message not in current:
        item["reason"] = f"{current} {message}".strip()


def downgrade(item, message):
    if str(item.get("recommendation") or "").lower() == "publish":
        item["recommendation"] = "watch"
    append_reason(item, message)


def candidate_rank(item):
    recommendation = str(item.get("recommendation") or "").lower()
    recommendation_rank = {"publish": 2, "watch": 1, "skip": 0}.get(recommendation, 0)
    try:
        score = int((item.get("scores") or {}).get("total", 0))
    except (TypeError, ValueError):
        score = 0
    return recommendation_rank, score


def deduplicate_candidates(candidates):
    """Keep one strongest candidate for each underlying event_key.

    Candidates without an event_key are retained so the quality guard can
    downgrade them explicitly instead of silently hiding them.
    """
    result = []
    positions = {}
    removed = 0

    for item in candidates:
        event_key = str(item.get("event_key") or "").strip().lower()
        if not event_key:
            result.append(item)
            continue

        if event_key not in positions:
            positions[event_key] = len(result)
            result.append(item)
            continue

        removed += 1
        index = positions[event_key]
        existing = result[index]
        if candidate_rank(item) > candidate_rank(existing):
            # Preserve a useful Japanese verification aid if the discarded
            # version happened to contain one and the stronger version did not.
            if not item.get("japanese_verification_summary") and existing.get("japanese_verification_summary"):
                item["japanese_verification_summary"] = existing.get("japanese_verification_summary")
            if not item.get("japanese_source_url") and existing.get("japanese_source_url"):
                item["japanese_source_url"] = existing.get("japanese_source_url")
                item["japanese_source_name"] = existing.get("japanese_source_name")
            result[index] = item
        else:
            if not existing.get("japanese_verification_summary") and item.get("japanese_verification_summary"):
                existing["japanese_verification_summary"] = item.get("japanese_verification_summary")
            if not existing.get("japanese_source_url") and item.get("japanese_source_url"):
                existing["japanese_source_url"] = item.get("japanese_source_url")
                existing["japanese_source_name"] = item.get("japanese_source_name")

    return result, removed


def main():
    queues = sorted(QUEUE_DIR.glob("*.json"))
    if not queues:
        print("No editorial queue found; quality guard skipped.")
        return 0

    json_path = queues[-1]
    queue = json.loads(json_path.read_text(encoding="utf-8"))
    candidates = list(queue.get("candidates", []))
    candidates, duplicates_removed = deduplicate_candidates(candidates)
    queue["candidates"] = candidates

    downgraded = 0

    for item in candidates:
        before = str(item.get("recommendation") or "").lower()
        title = str(item.get("title") or "")
        location = str(item.get("location") or "")
        scope = str(item.get("scope") or "").lower()
        formal_status = str(item.get("formal_status") or "").lower()
        event_key = str(item.get("event_key") or "").strip()
        what_changed = str(item.get("what_changed") or "")
        why_it_matters = str(item.get("why_it_matters") or "")

        if before != "publish":
            continue

        if scope != "single_event":
            downgrade(item, "Quality guard: publish candidates must be scoped to one traveler event.")

        if re.search(r"\bvarious\b|\bmultiple\b", location, flags=re.I):
            downgrade(item, "Quality guard: vague multi-location candidates require human narrowing.")

        if title.count(",") >= 2 or re.search(r",[^:]+\band\b", title, flags=re.I):
            downgrade(item, "Quality guard: headline appears to combine multiple places or events.")

        risky_terms = re.search(r"\b(warning|warnings|advisory|advisories|alert|alerts)\b", title, flags=re.I)
        if risky_terms and formal_status != "confirmed_formal_status":
            downgrade(item, "Quality guard: formal emergency terminology is not confirmed by the candidate metadata.")

        combined = f"{title} {what_changed} {why_it_matters}".lower()
        routine_ash = (
            "ash forecast" in combined
            or "ashfall forecast" in combined
            or "volcanic ash forecast" in combined
        )
        conditional_eruption = bool(re.search(r"\bif (?:an )?eruption occurs\b|\bif .*erupts\b|\bin the event of an eruption\b", combined))
        confirmed_change = bool(re.search(r"\b(has erupted|eruption occurred|confirmed eruption|alert level (?:raised|lowered|changed)|access (?:closed|restricted)|closure|transport (?:impact|disruption))\b", combined))
        if routine_ash and conditional_eruption and not confirmed_change:
            downgrade(item, "Quality guard: routine conditional ash forecasts stay on WATCH unless a new eruption or traveler-operational change is confirmed.")

        if not event_key:
            downgrade(item, "Quality guard: stable event_key is required before automatic drafting.")

        after = str(item.get("recommendation") or "").lower()
        if before == "publish" and after != "publish":
            downgraded += 1

    queue["quality_guard"] = {
        "enabled": True,
        "duplicates_removed": duplicates_removed,
        "downgraded_publish_candidates": downgraded,
        "rules": [
            "deduplicate by stable event_key",
            "single event only",
            "no vague multi-location publish candidates",
            "no apparent multi-event headlines",
            "formal alert terminology must be explicitly confirmed",
            "routine conditional ash forecasts require a new operational change",
            "stable event_key required"
        ]
    }

    json_path.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path = json_path.with_suffix(".md")
    write_markdown(queue, md_path)
    print(
        "Editorial quality guard complete. "
        f"Duplicates removed: {duplicates_removed}. "
        f"Downgraded publish candidates: {downgraded}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
