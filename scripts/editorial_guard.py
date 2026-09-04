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


def main():
    queues = sorted(QUEUE_DIR.glob("*.json"))
    if not queues:
        print("No editorial queue found; quality guard skipped.")
        return 0

    json_path = queues[-1]
    queue = json.loads(json_path.read_text(encoding="utf-8"))
    downgraded = 0

    for item in queue.get("candidates", []):
        before = str(item.get("recommendation") or "").lower()
        title = str(item.get("title") or "")
        location = str(item.get("location") or "")
        scope = str(item.get("scope") or "").lower()
        formal_status = str(item.get("formal_status") or "").lower()
        event_key = str(item.get("event_key") or "").strip()

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

        if not event_key:
            downgrade(item, "Quality guard: stable event_key is required before automatic drafting.")

        after = str(item.get("recommendation") or "").lower()
        if before == "publish" and after != "publish":
            downgraded += 1

    queue["quality_guard"] = {
        "enabled": True,
        "downgraded_publish_candidates": downgraded,
        "rules": [
            "single event only",
            "no vague multi-location publish candidates",
            "no apparent multi-event headlines",
            "formal alert terminology must be explicitly confirmed",
            "stable event_key required"
        ]
    }

    json_path.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path = json_path.with_suffix(".md")
    write_markdown(queue, md_path)
    print(f"Editorial quality guard complete. Downgraded publish candidates: {downgraded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
